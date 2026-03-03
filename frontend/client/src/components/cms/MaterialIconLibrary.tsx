/**
 * CreatorHub Norge - Material UI Icon Library for Visual CMS
 * Searchable picker for Material UI icons used in admin visual editor.
 */

import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Check, Close, ContentCopy, Search } from '@mui/icons-material';
import * as MaterialIcons from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface MaterialIconLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectIcon: (iconName: string, iconComponent: React.ComponentType) => void;
}

const ICON_CATEGORIES: Record<string, string[]> = {
  Action: ['Add', 'Delete', 'Edit', 'Save', 'Search', 'Settings', 'Home'],
  Communication: ['Email', 'Phone', 'Chat', 'Message', 'Forum', 'Call'],
  Content: ['Create', 'ContentCopy', 'ContentCut', 'ContentPaste', 'Undo', 'Redo'],
  Device: ['Computer', 'PhoneAndroid', 'Tablet', 'Watch', 'Tv'],
  File: ['Folder', 'InsertDriveFile', 'CloudUpload', 'CloudDownload', 'Attachment'],
  Image: ['Image', 'PhotoLibrary', 'Crop', 'Brightness6', 'Contrast'],
  Navigation: ['ArrowBack', 'ArrowForward', 'ChevronLeft', 'ChevronRight'],
  Notification: ['Notifications', 'Warning', 'Error', 'Info'],
  Social: ['Person', 'Group', 'Public', 'Share', 'Favorite', 'Star'],
  AV: ['PlayArrow', 'Pause', 'Stop', 'VolumeUp', 'Replay', 'FastForward'],
  Business: ['Business', 'Work', 'Assignment', 'Assessment', 'BarChart'],
  Creative: ['Brush', 'Palette', 'ColorLens', 'Gesture', 'AutoFixHigh'],
};

const POPULAR_ICONS = [
  'Home',
  'Search',
  'Menu',
  'Settings',
  'Person',
  'Email',
  'Phone',
  'Share',
  'Favorite',
  'Star',
  'Add',
  'Edit',
  'Delete',
  'Save',
  'CloudUpload',
  'CloudDownload',
  'Image',
  'Videocam',
  'MusicNote',
  'Business',
  'Dashboard',
  'Analytics',
  'TrendingUp',
  'Schedule',
  'Event',
  'Notifications',
];

const iconsMap = MaterialIcons as Record<string, React.ComponentType>;

export default function MaterialIconLibrary({ open, onClose, onSelectIcon }: MaterialIconLibraryProps) {
  const theming = useTheming('photographer');
  const [searchTerm, setSearchTerm] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);

  const allIconNames = useMemo(() => {
    return Object.keys(iconsMap).filter((name) => typeof iconsMap[name] === 'function').sort();
  }, []);

  const categoryNames = useMemo(() => Object.keys(ICON_CATEGORIES), []);

  const iconNames = useMemo(() => {
    let names: string[];

    if (tabIndex === 0) {
      names = POPULAR_ICONS.filter((iconName) => allIconNames.includes(iconName));
    } else {
      const category = categoryNames[tabIndex - 1];
      if (!category) {
        names = allIconNames;
      } else {
        const probes = ICON_CATEGORIES[category] ?? [];
        names = allIconNames.filter((name) => probes.some((probe) => name.includes(probe)));
      }
    }

    if (!searchTerm.trim()) {
      return names.slice(0, 240);
    }

    const lowered = searchTerm.trim().toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(lowered)).slice(0, 240);
  }, [allIconNames, categoryNames, searchTerm, tabIndex]);

  const handleSelect = (iconName: string) => {
    const IconComponent = iconsMap[iconName];
    if (!IconComponent) {
      return;
    }
    onSelectIcon(iconName, IconComponent);
    onClose();
  };

  const handleCopy = async (iconName: string) => {
    if (!navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(iconName);
    setCopiedIcon(iconName);
    setTimeout(() => setCopiedIcon(null), 1200);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ ...theming.getThemedCardSx(), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Material Icon Library</Typography>
        <IconButton onClick={onClose} aria-label="Close icon picker">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={theming.getThemedCardSx()}>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            fullWidth
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search icons"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          <Autocomplete
            sx={{ minWidth: 260 }}
            options={allIconNames}
            onChange={(_event, value) => {
              if (value) {
                setSearchTerm(value);
              }
            }}
            renderInput={(params) => <TextField {...params} label="Quick jump" size="small" />}
          />
        </Box>

        <Tabs
          value={tabIndex}
          onChange={(_event, value) => setTabIndex(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          <Tab label="Popular" />
          {categoryNames.map((categoryName) => (
            <Tab key={categoryName} label={categoryName} />
          ))}
        </Tabs>

        <Grid container spacing={1.5}>
          {iconNames.map((iconName) => {
            const IconComponent = iconsMap[iconName];
            if (!IconComponent) {
              return null;
            }

            return (
              <Grid key={iconName} item xs={6} sm={4} md={3} lg={2}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 3,
                    },
                  }}
                  onClick={() => handleSelect(iconName)}
                >
                  <CardContent sx={{ p: 1.5, textAlign: 'center', '&:last-child': { pb: 1.5 }, ...theming.getThemedCardSx() }}>
                    <Box sx={{ minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconComponent />
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-word' }}>
                      {iconName}
                    </Typography>
                    <Tooltip title={copiedIcon === iconName ? 'Copied' : 'Copy icon name'}>
                      <IconButton
                        size="small"
                        aria-label={`Copy ${iconName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleCopy(iconName);
                        }}
                      >
                        {copiedIcon === iconName ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>

      <DialogActions sx={theming.getThemedCardSx()}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
          Showing {iconNames.length} of {allIconNames.length} icons
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
