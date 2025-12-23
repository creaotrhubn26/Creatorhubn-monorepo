/**
 * CreatorHub Norge - Material UI Icon Library for Visual CMS
 * Komplett tilgang til alle Material UI ikoner i Visual CMS
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  TextField,
  Typography,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  InputAdornment,
  Tab,
  Tabs,
  Autocomplete,
  Tooltip
} from '@mui/material';
import { Search, Close, ContentCopy, Check } from '@mui/icons-material';

// Import all Material UI icons
import * as MaterialIcons from '@mui/icons-material';

interface MaterialIconLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectIcon: (iconName: string, iconComponent: React.ComponentType) => void
}

// Icon categories
const ICON_CATEGORIES = {
  'Action': ['Add','Delete','Edit','Save','Cancel','Done','Search','Settings','Home','Menu']'Communication': ['Email','Phone','Chat','Message','Call','VideoCall','Forum','Comment']'Content': ['Create','ContentCopy','ContentCut','ContentPaste','Clear','SelectAll','Undo','Redo']'Device': ['Computer','Phone','Tablet','Watch','Tv','Camera','Memory','Storage']'Editor': ['FormatBold','FormatItalic','FormatUnderlined','FormatAlignLeft','FormatAlignCenter','FormatAlignRight']'File': ['Folder','InsertDriveFile','CloudUpload','CloudDownload','Attachment','Archive']'Hardware': ['Keyboard','Mouse','Headset','Speaker','Microphone','Camera']'Image': ['Image','PhotoLibrary','Crop','Rotate90DegreesCcw','Brightness6','Contrast']'Maps': ['Place','Navigation','MyLocation','LocationOn','DirectionsCar','DirectionsWalk']'Navigation': ['ArrowBack','ArrowForward','ArrowUpward','ArrowDownward','ChevronLeft','ChevronRight']'Notification': ['Notifications','NotificationsActive','NotificationsOff','Warning','Error','Info']'Social': ['Person','Group','Public','Share','ThumbUp','Favorite','Star']'Toggle': ['CheckBox','RadioButtonChecked','ToggleOn','ToggleOff','Star','StarBorder']'AV': ['Play','Pause','Stop','VolumeUp','VolumeDown','VolumeMute','Replay','FastForward']'Photography': ['CameraAlt','PhotoCamera','Portrait','Landscape','FlashOn','FlashOff','Timer','Exposure']'Video': ['Videocam','Movie','VideoLibrary','Theaters','OndemandVideo','LiveTv','Subscriptions']'Business': ['Business','Work','Assignment','Assessment','AccountBalance','TrendingUp','BarChart']'Creative': ['Brush','Palette','ColorLens','FormatPaint','Gesture','Create','AutoFixHigh']
};

// Get popular icons for quick access
const POPULAR_ICONS = [
  'Home','Search','Menu','Settings','Person','Email','Phone','Share','Favorite','Star','Add','Edit','Delete','Save','Download','Upload','CameraAlt','PhotoCamera','Videocam','Image','MusicNote','Business','Dashboard','Analytics','TrendingUp','Schedule','Event','Notifications'
];

export default function MaterialIconLibrary({ open, onClose, onSelectIcon }: MaterialIconLibraryProps) {
  const [searchTerm, setSearchTerm] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);

  // Get all icon names
  const allIconNames = useMemo(() => {
    return Object.keys(MaterialIcons).filter(name => 
      typeof (MaterialIcons as any)[name] === 'function' ||
      typeof (MaterialIcons as any)[name] === 'object'
    );
}, []);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let icons = allIconNames;

    // Filter by category
    if (selectedCategory > 0) {
      const categoryName = Object.keys(ICON_CATEGORIES)[selectedCategory - 1];
      const categoryIcons = ICON_CATEGORIES[categoryName as keyof typeof ICON_CATEGORIES];
      icons = allIconNames.filter(name => 
        categoryIcons.some(catIcon => name.includes(catIcon))
      );
  } else if (selectedCategory === 0) {
      icons = POPULAR_ICONS;
  }

    // Filter by search term
    if (searchTerm) {
      icons = icons.filter(name =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }

    return icons.slice(0, 200); // Limit to 200 for performance
}, [searchTerm, selectedCategory, allIconNames]);

  const handleIconSelect = (iconName: string) => {
    const IconComponent = (MaterialIcons as any)[iconName];
    if (IconComponent) {
      onSelectIcon(iconName, IconComponent);
      onClose();
  }
};

  const handleCopyIconName = (iconName: string) => {
    navigator.clipboard.writeText(iconName);
    setCopiedIcon(iconName);
    setTimeout(() => setCopiedIcon(null), 2000);
};

  const renderIcon = (iconName: string) => {
    const IconComponent = (MaterialIcons as any)[iconName];
    if (!IconComponent) return null;

    return (
      <Card
        key={iconName}
        sx={{
          cursor: 'pointer',
          transition: 'all 0.2s ease', '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow:  4,
            bgcolor: 'action.hover'
      }
      }}
        onClick={() => handleIconSelect(iconName)}
      >
        <CardContent sx={{ textAlign: 'center', p: 2, '&:last-child': { pb: 2 }, ...theming.getThemedCardSx() }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap:  1 }}>
            <IconComponent sx={{ fontSize:  32, color: 'primary.main' }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', wordBreak: 'break-word' }}>
              {iconName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5}}>
              <Tooltip title="Bruk ikon">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIconSelect(iconName);
                }}
                  sx={{ fontSize: '0.8rem' }}
                >
                  <Check fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Kopier navn">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyIconName(iconName);
                }}
                  sx={{ fontSize: '0.8rem' }}
                >
                  {copiedIcon === iconName ? (
                    <Check fontSize="small" color="success" />
                  ) : (
                    <ContentCopy fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          🎨 Material UI Icon Library ({filteredIcons.length} ikoner)
        </Typography>
        <IconButton onClick={onClose}>
          {theming.getThemedIcon('close')}
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ height: '70vh' }}>
        <Box sx={{ mb:  3 }}>
          <TextField
            fullWidth
            placeholder="Søk etter ikoner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {theming.getThemedIcon('')}
                </InputAdornment>
              )
          }}
            sx={{ mb:  2 }}
          />

          <Tabs
            value={selectedCategory}
            onChange={(_, value) => setSelectedCategory(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Populære" />
            {Object.keys(ICON_CATEGORIES).map((category, index) => (
              <Tab key={category} label={category} />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`${filteredIcons.length} ikoner funnet`}
            color="primary"
            size="small"
          />
          {searchTerm && (
            <Chip
              label={`Søker: "${searchTerm}"`}
              color="secondary"
              size="small"
              onDelete={() => setSearchTerm(', ')}
            />
          )}
        </Box>

        <Grid container spacing={1} sx={{ maxHeight: 'calc(100% - 120px, )', overflow: 'auto' }}>
          {filteredIcons.map((iconName) => (
            <Grid size={{ xs:  6 }} sm={4} md={3} lg={2} key={iconName}>
              {renderIcon(iconName)}
            </Grid>
          ))}
        </Grid>

        {filteredIcons.length === 0 && (
          <Box sx={{ textAlign: 'center', mt:  4 }}>
            <Typography variant="h6" color="textSecondary" sx={{ color: theming.colors.primary }}>
              Ingen ikoner funnet
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Prøv et annet søkeord eller velg en annen kategori
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="body2" color="textSecondary" sx={{ flexGrow:  1 }}>
          💡 Tips: Klikk på et ikon for å bruke det, eller kopier navnet for kodebruk
        </Typography>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}