/**
 * Icon Picker Wiring
 * Searchable icon library with visual connector for wiring icons to components
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  IconButton,
  Tooltip,
  Stack,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Button,
} from '@mui/material';
import {
  Search,
  Check,
  ContentCopy,
  Favorite,
  FavoriteBorder,
  FormatSize,
  Home,
  Settings,
  Person,
  Email,
  Phone,
  Camera,
  Image,
  VideoCall,
  MusicNote,
  Folder,
  Star,
  Delete,
  Edit,
  Add,
  Remove,
  Close,
  Menu,
  MoreVert,
  ArrowBack,
  ArrowForward,
  ArrowDropDown,
  ArrowDropUp,
  Refresh,
  Save,
  Share,
  Download,
  Upload,
  Link,
  LinkOff,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Search as SearchIcon,
  FilterList,
  Sort,
  Dashboard,
  Analytics,
  BarChart,
  PieChart,
  Timeline,
  TrendingUp,
  TrendingDown,
  AttachMoney,
  ShoppingCart,
  CreditCard,
  Receipt,
  LocalShipping,
  Inventory,
  Store,
  Business,
  Work,
  School,
  Groups,
  Support,
  Help,
  Info,
  Warning,
  Error,
  CheckCircle,
  Cancel,
  Notifications,
  NotificationsOff,
  Message,
  Chat,
  Forum,
  Comment,
  ThumbUp,
  ThumbDown,
  Schedule,
  CalendarToday,
  Event,
  AccessTime,
  LocationOn,
  Map,
  Navigation,
  Language,
  Translate,
  Code,
  Terminal,
  Api,
  Storage,
  Cloud,
  CloudUpload,
  CloudDownload,
  Sync,
  Security,
  VpnKey,
  Fingerprint,
  Face,
  EmojiEmotions,
  Palette,
  Brush,
  ColorLens,
  AutoAwesome,
  Psychology,
  SmartToy,
  Bolt,
  FlashOn,
  FlashOff,
  WbSunny,
  DarkMode,
  LightMode,
  Contrast,
  Tune,
  Speed as Speed,
  Timer,
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CameraAlt,
  PhotoCamera,
  Print,
  Wifi,
  WifiOff,
  Bluetooth,
  BatteryFull,
  PowerSettingsNew,
  DeviceHub,
  Computer,
  Smartphone,
  Tablet,
  Watch,
  Keyboard,
  Mouse,
  Headphones,
  Speaker,
  Tv,
  Cast,
  ScreenShare,
  PresentToAll,
  Slideshow,
} from '@mui/icons-material';

// Icon definitions with categories and keywords
interface IconDefinition {
  name: string;
  component: React.ElementType;
  category: string;
  keywords: string[];
}

const ICONS: IconDefinition[] = [
  // Navigation
  { name: 'Home', component: Home, category: 'Navigation', keywords: ['house', 'main', 'start'] },
  { name: 'Menu', component: Menu, category: 'Navigation', keywords: ['hamburger', 'drawer'] },
  { name: 'ArrowBack', component: ArrowBack, category: 'Navigation', keywords: ['left', 'previous', 'return'] },
  { name: 'ArrowForward', component: ArrowForward, category: 'Navigation', keywords: ['right', 'next'] },
  { name: 'ArrowDropDown', component: ArrowDropDown, category: 'Navigation', keywords: ['expand', 'dropdown'] },
  { name: 'ArrowDropUp', component: ArrowDropUp, category: 'Navigation', keywords: ['collapse'] },
  { name: 'Close', component: Close, category: 'Navigation', keywords: ['x', 'dismiss', 'cancel'] },
  { name: 'MoreVert', component: MoreVert, category: 'Navigation', keywords: ['options', 'menu', 'dots'] },
  
  // Actions
  { name: 'Add', component: Add, category: 'Actions', keywords: ['plus', 'new', 'create'] },
  { name: 'Remove', component: Remove, category: 'Actions', keywords: ['minus', 'delete'] },
  { name: 'Delete', component: Delete, category: 'Actions', keywords: ['trash', 'remove', 'bin'] },
  { name: 'Edit', component: Edit, category: 'Actions', keywords: ['pencil', 'modify', 'update'] },
  { name: 'Save', component: Save, category: 'Actions', keywords: ['disk', 'floppy', 'store'] },
  { name: 'Refresh', component: Refresh, category: 'Actions', keywords: ['reload', 'sync', 'update'] },
  { name: 'Share', component: Share, category: 'Actions', keywords: ['send', 'distribute'] },
  { name: 'Download', component: Download, category: 'Actions', keywords: ['export', 'save'] },
  { name: 'Upload', component: Upload, category: 'Actions', keywords: ['import', 'send'] },
  { name: 'Search', component: SearchIcon, category: 'Actions', keywords: ['find', 'magnify', 'lookup'] },
  { name: 'FilterList', component: FilterList, category: 'Actions', keywords: ['filter', 'sort'] },
  { name: 'Sort', component: Sort, category: 'Actions', keywords: ['order', 'arrange'] },
  
  // Communication
  { name: 'Email', component: Email, category: 'Communication', keywords: ['mail', 'envelope', 'message'] },
  { name: 'Phone', component: Phone, category: 'Communication', keywords: ['call', 'telephone'] },
  { name: 'Chat', component: Chat, category: 'Communication', keywords: ['message', 'talk', 'bubble'] },
  { name: 'Message', component: Message, category: 'Communication', keywords: ['sms', 'text'] },
  { name: 'Forum', component: Forum, category: 'Communication', keywords: ['discussion', 'community'] },
  { name: 'Comment', component: Comment, category: 'Communication', keywords: ['feedback', 'note'] },
  { name: 'Notifications', component: Notifications, category: 'Communication', keywords: ['bell', 'alert'] },
  { name: 'NotificationsOff', component: NotificationsOff, category: 'Communication', keywords: ['mute', 'silent'] },
  
  // Media
  { name: 'Image', component: Image, category: 'Media', keywords: ['photo', 'picture', 'gallery'] },
  { name: 'Camera', component: Camera, category: 'Media', keywords: ['photo', 'capture'] },
  { name: 'CameraAlt', component: CameraAlt, category: 'Media', keywords: ['photo', 'picture'] },
  { name: 'PhotoCamera', component: PhotoCamera, category: 'Media', keywords: ['photo', 'capture'] },
  { name: 'VideoCall', component: VideoCall, category: 'Media', keywords: ['video', 'meeting'] },
  { name: 'Videocam', component: Videocam, category: 'Media', keywords: ['video', 'record'] },
  { name: 'MusicNote', component: MusicNote, category: 'Media', keywords: ['audio', 'song', 'sound', 'music'] },
  { name: 'PlayArrow', component: PlayArrow, category: 'Media', keywords: ['start', 'run'] },
  { name: 'Pause', component: Pause, category: 'Media', keywords: ['hold', 'wait'] },
  { name: 'Stop', component: Stop, category: 'Media', keywords: ['end', 'halt'] },
  { name: 'VolumeUp', component: VolumeUp, category: 'Media', keywords: ['sound', 'audio', 'speaker'] },
  { name: 'VolumeOff', component: VolumeOff, category: 'Media', keywords: ['mute', 'silent'] },
  { name: 'Mic', component: Mic, category: 'Media', keywords: ['microphone', 'voice', 'record'] },
  
  // Business
  { name: 'Dashboard', component: Dashboard, category: 'Business', keywords: ['admin', 'panel', 'overview'] },
  { name: 'Analytics', component: Analytics, category: 'Business', keywords: ['stats', 'data', 'metrics'] },
  { name: 'BarChart', component: BarChart, category: 'Business', keywords: ['graph', 'chart', 'statistics'] },
  { name: 'PieChart', component: PieChart, category: 'Business', keywords: ['graph', 'chart', 'statistics'] },
  { name: 'TrendingUp', component: TrendingUp, category: 'Business', keywords: ['growth', 'increase', 'profit'] },
  { name: 'TrendingDown', component: TrendingDown, category: 'Business', keywords: ['decline', 'decrease', 'loss'] },
  { name: 'AttachMoney', component: AttachMoney, category: 'Business', keywords: ['dollar', 'price', 'currency'] },
  { name: 'ShoppingCart', component: ShoppingCart, category: 'Business', keywords: ['buy', 'cart', 'ecommerce'] },
  { name: 'CreditCard', component: CreditCard, category: 'Business', keywords: ['payment', 'card'] },
  { name: 'Receipt', component: Receipt, category: 'Business', keywords: ['invoice', 'bill'] },
  { name: 'Store', component: Store, category: 'Business', keywords: ['shop', 'retail'] },
  { name: 'Business', component: Business, category: 'Business', keywords: ['company', 'office', 'building'] },
  { name: 'Work', component: Work, category: 'Business', keywords: ['briefcase', 'job', 'career'] },
  
  // People
  { name: 'Person', component: Person, category: 'People', keywords: ['user', 'profile', 'account'] },
  { name: 'Groups', component: Groups, category: 'People', keywords: ['team', 'users', 'community'] },
  { name: 'Face', component: Face, category: 'People', keywords: ['user', 'avatar', 'profile'] },
  { name: 'Support', component: Support, category: 'People', keywords: ['help', 'agent'] },
  { name: 'School', component: School, category: 'People', keywords: ['education', 'learn', 'academy'] },
  
  // Status
  { name: 'CheckCircle', component: CheckCircle, category: 'Status', keywords: ['success', 'done', 'complete'] },
  { name: 'Cancel', component: Cancel, category: 'Status', keywords: ['error', 'close', 'remove'] },
  { name: 'Warning', component: Warning, category: 'Status', keywords: ['alert', 'caution'] },
  { name: 'Error', component: Error, category: 'Status', keywords: ['problem', 'issue'] },
  { name: 'Info', component: Info, category: 'Status', keywords: ['information', 'details'] },
  { name: 'Help', component: Help, category: 'Status', keywords: ['question', 'support'] },
  
  // Security
  { name: 'Lock', component: Lock, category: 'Security', keywords: ['secure', 'private', 'password'] },
  { name: 'LockOpen', component: LockOpen, category: 'Security', keywords: ['unlock', 'open'] },
  { name: 'Security', component: Security, category: 'Security', keywords: ['shield', 'protect'] },
  { name: 'VpnKey', component: VpnKey, category: 'Security', keywords: ['key', 'access'] },
  { name: 'Fingerprint', component: Fingerprint, category: 'Security', keywords: ['biometric', 'identity'] },
  { name: 'Visibility', component: Visibility, category: 'Security', keywords: ['show', 'eye', 'view'] },
  { name: 'VisibilityOff', component: VisibilityOff, category: 'Security', keywords: ['hide', 'eye', 'hidden'] },
  
  // Development
  { name: 'Code', component: Code, category: 'Development', keywords: ['programming', 'developer'] },
  { name: 'Terminal', component: Terminal, category: 'Development', keywords: ['console', 'cli'] },
  { name: 'Api', component: Api, category: 'Development', keywords: ['endpoint', 'rest'] },
  { name: 'Storage', component: Storage, category: 'Development', keywords: ['database', 'data'] },
  { name: 'Cloud', component: Cloud, category: 'Development', keywords: ['server', 'hosting'] },
  { name: 'CloudUpload', component: CloudUpload, category: 'Development', keywords: ['upload', 'deploy'] },
  { name: 'CloudDownload', component: CloudDownload, category: 'Development', keywords: ['download', 'fetch'] },
  
  // AI & Creative
  { name: 'AutoAwesome', component: AutoAwesome, category: 'AI & Creative', keywords: ['magic', 'ai', 'smart'] },
  { name: 'Psychology', component: Psychology, category: 'AI & Creative', keywords: ['brain', 'ai', 'ml'] },
  { name: 'SmartToy', component: SmartToy, category: 'AI & Creative', keywords: ['robot', 'ai', 'bot'] },
  { name: 'Palette', component: Palette, category: 'AI & Creative', keywords: ['color', 'design', 'art'] },
  { name: 'Brush', component: Brush, category: 'AI & Creative', keywords: ['paint', 'design'] },
  { name: 'ColorLens', component: ColorLens, category: 'AI & Creative', keywords: ['color', 'picker'] },
  
  // Theme
  { name: 'DarkMode', component: DarkMode, category: 'Theme', keywords: ['dark', 'night', 'moon'] },
  { name: 'LightMode', component: LightMode, category: 'Theme', keywords: ['light', 'day', 'sun'] },
  { name: 'WbSunny', component: WbSunny, category: 'Theme', keywords: ['sun', 'light', 'bright'] },
  { name: 'Contrast', component: Contrast, category: 'Theme', keywords: ['theme', 'mode'] },
  { name: 'Tune', component: Tune, category: 'Theme', keywords: ['settings', 'adjust'] },
  
  // General
  { name: 'Settings', component: Settings, category: 'General', keywords: ['gear', 'config', 'options'] },
  { name: 'Star', component: Star, category: 'General', keywords: ['favorite', 'rate', 'bookmark'] },
  { name: 'Favorite', component: Favorite, category: 'General', keywords: ['heart', 'like', 'love'] },
  { name: 'ThumbUp', component: ThumbUp, category: 'General', keywords: ['like', 'approve'] },
  { name: 'ThumbDown', component: ThumbDown, category: 'General', keywords: ['dislike', 'reject'] },
  { name: 'Folder', component: Folder, category: 'General', keywords: ['directory', 'files'] },
  { name: 'Link', component: Link, category: 'General', keywords: ['url', 'chain', 'connect'] },
  { name: 'LinkOff', component: LinkOff, category: 'General', keywords: ['unlink', 'disconnect', 'broken'] },
  { name: 'Schedule', component: Schedule, category: 'General', keywords: ['time', 'clock'] },
  { name: 'CalendarToday', component: CalendarToday, category: 'General', keywords: ['date', 'event'] },
  { name: 'Event', component: Event, category: 'General', keywords: ['calendar', 'schedule', 'date'] },
  { name: 'AccessTime', component: AccessTime, category: 'General', keywords: ['clock', 'time', 'schedule'] },
  { name: 'LocationOn', component: LocationOn, category: 'General', keywords: ['pin', 'map', 'place'] },
  { name: 'Map', component: Map, category: 'General', keywords: ['location', 'navigation', 'geography'] },
  { name: 'Navigation', component: Navigation, category: 'General', keywords: ['direction', 'compass', 'arrow'] },
  { name: 'Language', component: Language, category: 'General', keywords: ['globe', 'world', 'i18n'] },
  { name: 'Translate', component: Translate, category: 'General', keywords: ['language', 'i18n'] },
  { name: 'EmojiEmotions', component: EmojiEmotions, category: 'General', keywords: ['emoji', 'smiley', 'happy'] },

  // Charts & Analytics (extended)
  { name: 'Timeline', component: Timeline, category: 'Business', keywords: ['history', 'progress', 'steps'] },
  { name: 'LocalShipping', component: LocalShipping, category: 'Business', keywords: ['delivery', 'truck', 'shipping'] },
  { name: 'Inventory', component: Inventory, category: 'Business', keywords: ['stock', 'products', 'warehouse'] },

  // Performance & Speed
  { name: 'Speed', component: Speed, category: 'Performance', keywords: ['fast', 'speedometer', 'gauge'] },
  { name: 'Timer', component: Timer, category: 'Performance', keywords: ['stopwatch', 'countdown', 'time'] },
  { name: 'Bolt', component: Bolt, category: 'Performance', keywords: ['lightning', 'fast', 'power'] },
  { name: 'FlashOn', component: FlashOn, category: 'Performance', keywords: ['flash', 'lightning', 'camera'] },
  { name: 'FlashOff', component: FlashOff, category: 'Performance', keywords: ['no flash', 'lightning off'] },

  // Media Player (extended)
  { name: 'SkipNext', component: SkipNext, category: 'Media', keywords: ['next', 'forward', 'skip'] },
  { name: 'SkipPrevious', component: SkipPrevious, category: 'Media', keywords: ['previous', 'back', 'rewind'] },
  { name: 'MicOff', component: MicOff, category: 'Media', keywords: ['mute', 'microphone', 'silent'] },
  { name: 'VideocamOff', component: VideocamOff, category: 'Media', keywords: ['camera off', 'video off'] },
  { name: 'Print', component: Print, category: 'Media', keywords: ['printer', 'document', 'output'] },
  { name: 'Slideshow', component: Slideshow, category: 'Media', keywords: ['presentation', 'slides', 'show'] },

  // Connectivity
  { name: 'Wifi', component: Wifi, category: 'Connectivity', keywords: ['wireless', 'internet', 'network'] },
  { name: 'WifiOff', component: WifiOff, category: 'Connectivity', keywords: ['no wifi', 'offline', 'disconnected'] },
  { name: 'Bluetooth', component: Bluetooth, category: 'Connectivity', keywords: ['wireless', 'connect', 'pair'] },
  { name: 'Sync', component: Sync, category: 'Connectivity', keywords: ['refresh', 'synchronize', 'update'] },
  { name: 'Cast', component: Cast, category: 'Connectivity', keywords: ['chromecast', 'stream', 'mirror'] },
  { name: 'ScreenShare', component: ScreenShare, category: 'Connectivity', keywords: ['share', 'present', 'stream'] },
  { name: 'PresentToAll', component: PresentToAll, category: 'Connectivity', keywords: ['presentation', 'share', 'broadcast'] },

  // Devices
  { name: 'Computer', component: Computer, category: 'Devices', keywords: ['desktop', 'pc', 'monitor'] },
  { name: 'Smartphone', component: Smartphone, category: 'Devices', keywords: ['mobile', 'phone', 'cell'] },
  { name: 'Tablet', component: Tablet, category: 'Devices', keywords: ['ipad', 'tab', 'mobile'] },
  { name: 'Watch', component: Watch, category: 'Devices', keywords: ['smartwatch', 'wearable', 'time'] },
  { name: 'Keyboard', component: Keyboard, category: 'Devices', keywords: ['type', 'input', 'keys'] },
  { name: 'Mouse', component: Mouse, category: 'Devices', keywords: ['click', 'pointer', 'input'] },
  { name: 'Headphones', component: Headphones, category: 'Devices', keywords: ['audio', 'music', 'listen'] },
  { name: 'Speaker', component: Speaker, category: 'Devices', keywords: ['audio', 'sound', 'music'] },
  { name: 'Tv', component: Tv, category: 'Devices', keywords: ['television', 'screen', 'display'] },
  { name: 'DeviceHub', component: DeviceHub, category: 'Devices', keywords: ['hub', 'connect', 'iot'] },

  // Power & Battery
  { name: 'BatteryFull', component: BatteryFull, category: 'Power', keywords: ['charge', 'energy', 'power', 'battery'] },
  { name: 'PowerSettingsNew', component: PowerSettingsNew, category: 'Power', keywords: ['on', 'off', 'power button'] },
];

const CATEGORIES = [...new Set(ICONS.map((i) => i.category))];

interface IconPickerWiringProps {
  onSelect: (iconName: string, iconComponent: React.ElementType) => void;
  selectedIcon?: string;
  showPreview?: boolean;
}

export function IconPickerWiring({
  onSelect,
  selectedIcon,
  showPreview = true,
}: IconPickerWiringProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [iconSize, setIconSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [previewSize, setPreviewSize] = useState(24);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);

  // Filter icons
  const filteredIcons = useMemo(() => {
    let icons = ICONS;

    // Filter by tab (category or favorites)
    if (activeTab === 1) {
      icons = icons.filter((i) => favorites.includes(i.name));
    } else if (activeTab > 1) {
      const category = CATEGORIES[activeTab - 2];
      icons = icons.filter((i) => i.category === category);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      icons = icons.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          i.keywords.some((k) => k.includes(query))
      );
    }

    return icons;
  }, [searchQuery, activeTab, favorites]);

  const toggleFavorite = useCallback((name: string) => {
    setFavorites((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  }, []);

  const handleCopyImport = useCallback((name: string) => {
    const importStatement = `import { ${name} } from '@mui/icons-material';`;
    navigator.clipboard.writeText(importStatement);
    setCopiedIcon(name);
    setTimeout(() => setCopiedIcon(null), 2000);
  }, []);

  const getIconSizePx = () => {
    switch (iconSize) {
      case 'small':
        return 20;
      case 'large':
        return 32;
      default:
        return 24;
    }
  };

  return (
    <Paper
      sx={{
        height: '100%',
        bgcolor: 'rgba(20,20,30,0.98)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="h6" color="white" gutterBottom>
          Icon Library
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            },
            '& input': { color: 'white' },
          }}
        />

        {/* Size toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormatSize sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
          <ToggleButtonGroup
            value={iconSize}
            exclusive
            onChange={(_, value) => value && setIconSize(value)}
            size="small"
          >
            <ToggleButton value="small" sx={{ color: 'white', py: 0.25 }}>S</ToggleButton>
            <ToggleButton value="medium" sx={{ color: 'white', py: 0.25 }}>M</ToggleButton>
            <ToggleButton value="large" sx={{ color: 'white', py: 0.25 }}>L</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Category tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          minHeight: 36,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', minHeight: 36, py: 0 },
          '& .Mui-selected': { color: '#ff6b00' },
          '& .MuiTabs-indicator': { bgcolor: '#ff6b00' },
        }}
      >
        <Tab label="All" />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Favorite sx={{ fontSize: 14 }} />
              {favorites.length > 0 && <span>({favorites.length})</span>}
            </Box>
          }
        />
        {CATEGORIES.map((cat) => (
          <Tab key={cat} label={cat} />
        ))}
      </Tabs>

      {/* Icon grid */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        <Grid container spacing={0.5}>
          {filteredIcons.map((icon) => {
            const IconComponent = icon.component;
            return (
              <Grid item key={icon.name}>
                <Tooltip
                  title={
                    <Box>
                      <Typography variant="body2">{icon.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {icon.category}
                      </Typography>
                    </Box>
                  }
                >
                  <Box
                    onClick={() => onSelect(icon.name, icon.component)}
                    sx={{
                      width: getIconSizePx() + 16,
                      height: getIconSizePx() + 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      bgcolor:
                        selectedIcon === icon.name
                          ? 'rgba(255,107,0,0.3)'
                          : 'rgba(255,255,255,0.03)',
                      border:
                        selectedIcon === icon.name
                          ? '2px solid #ff6b00'
                          : '1px solid transparent',
                      '&:hover': {
                        bgcolor: 'rgba(255,107,0,0.15)',
                        '& .icon-actions': { opacity: 1 },
                      },
                    }}
                  >
                    <IconComponent
                      sx={{ fontSize: getIconSizePx(), color: 'white' }}
                    />
                    {/* Hover actions */}
                    <Box
                      className="icon-actions"
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        display: 'flex',
                        gap: 0.25,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(icon.name);
                        }}
                        sx={{
                          bgcolor: 'rgba(0,0,0,0.8)',
                          width: 18,
                          height: 18,
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                        }}
                      >
                        {favorites.includes(icon.name) ? (
                          <Favorite sx={{ fontSize: 12, color: '#e91e63' }} />
                        ) : (
                          <FavoriteBorder sx={{ fontSize: 12, color: 'white' }} />
                        )}
                      </IconButton>
                    </Box>
                  </Box>
                </Tooltip>
              </Grid>
            );
          })}
        </Grid>

        {filteredIcons.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="rgba(255,255,255,0.3)">
              No icons found
            </Typography>
          </Box>
        )}
      </Box>

      {/* Preview & actions */}
      {showPreview && selectedIcon && (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 60,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: 1,
              }}
            >
              {(() => {
                const icon = ICONS.find((i) => i.name === selectedIcon);
                if (icon) {
                  const IconComp = icon.component;
                  return <IconComp sx={{ fontSize: previewSize, color: '#ff6b00' }} />;
                }
                return null;
              })()}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="white">
                {selectedIcon}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="rgba(255,255,255,0.5)">
                  Size: {previewSize}px
                </Typography>
                <Slider
                  value={previewSize}
                  onChange={(_, value) => setPreviewSize(value as number)}
                  min={12}
                  max={48}
                  sx={{ width: 80, color: '#ff6b00' }}
                />
              </Box>
            </Box>
            <Button
              size="small"
              startIcon={copiedIcon === selectedIcon ? <Check /> : <ContentCopy />}
              onClick={() => handleCopyImport(selectedIcon)}
              sx={{ color: copiedIcon === selectedIcon ? '#4caf50' : '#ff6b00' }}
            >
              {copiedIcon === selectedIcon ? 'Copied!' : 'Copy Import'}
            </Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

export default IconPickerWiring;

