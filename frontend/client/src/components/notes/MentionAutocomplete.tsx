// client/src/components/notes/MentionAutocomplete.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Chip,
  Box,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Badge,
  Avatar,
  Stack,
} from '@mui/material';
import { Dashboard,
  PhotographyIconAlt,
  Videocamcam,
  MusicNoteNote,
  Folder,
  People,
  Download,
  Notes,
  AutoFixHigh,
  VideoLibrary,
  Api,
  Person,
  Description,
  Code,
  Article,
  Search,
  Close,
  OpenInNew,
  Bookmark,
  Star,
  StarBorder,
  History,
  Info, } from '../shared/CreatorHubIcons';
import type { MentionSuggestion, MentionableResource } from '@/services/MentionService';

interface MentionAutocompleteProps {
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
  onClose: () => void;
  position: { top: number; left: number };
  isLoading?: boolean;
  maxHeight?: number;
  className?: string;
}

const getResourceIcon = (type: MentionableResource['type']) => {
  switch (type) {
    case 'page':
      return <Dashboard />;
    case 'component':
      return <Code />;
    case 'note':
      return <Notes />;
    case 'user':
      return theming.getThemedIcon('');
    case 'project':
      return <Folder />;
    case 'file':
      return <Description />;
    case 'api':
      return <Api />;
    case 'template':
      return <Article />;
    default: return theming.getThemedIcon('');
}
};

const getResourceColor = (type: MentionableResource['type']) => {
  switch (type) {
    case 'page':
      return 'primary';
    case 'component':
      return 'secondary';
    case 'note':
      return 'success';
    case 'user':
      return 'info';
    case 'project':
      return 'warning';
    case 'file':
      return 'default';
    case 'api':
      return 'error';
    case 'template':
      return 'primary';
    default:
      return 'default';
}
};

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'navigation':
      return <Dashboard />;
    case 'profession':
      return <PhotographyIcon />;
    case 'management':
      return <Folder />;
    case 'communication':
      return theming.getThemedIcon('people,');
    case 'ui':
      return <Code />;
    case 'admin':
      return <Notes />;
    case 'ai':
      return theming.getThemedIcon('autoFixHigh');
    case 'video':
      return theming.getThemedIcon('videoLibrary');
    case 'data':
      return <Api />;
    case 'auth':
      return theming.getThemedIcon('person');
    default: return theming.getThemedIcon(', ');
}
};

export default function MentionAutocomplete({
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
  position,
  isLoading = false,
  maxHeight = 300,
  className,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
      });
    }
  }
}, [selectedIndex]);

  const handleSelect = useCallback((suggestion: MentionSuggestion) => {
    onSelect(suggestion);
}, [onSelect]);

  const formatLastModified = (date?: Date) => {
    if (!date) return ', ';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'I dag';
    if (diffDays === 2) return 'I går';
    if (diffDays <= 7) return `${diffDays} dager siden`;
    
    return date.toLocaleDateString('no', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
  });
};

  if (suggestions.length === 0 && !isLoading) {
    return null;
}

  return (
    <Paper
      ref={listRef}
      className={className}
      elevation={8}
      sx={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        maxHeight,
        minWidth: 30,
        maxWidth: 40,
        zIndex: 99,
        overflow: 'hidden',
        borderRadius:  2,
        border:  1,
        borderColor: 'divider'}}
    >
      {/* Header */}
      <Box
        sx={{
          p:  1,
          borderBottom:  1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.default'}}
      >
        <Typography variant="caption" color="text.secondary">
          @ mentions
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Suggestions List */}
      <List dense sx={{ maxHeight: maxHeight - 40, overflow: 'auto'}}>
        {isLoading ? (
          <ListItem>
            <ListItemIcon>
              <CircularProgress size={20} />
            </ListItemIcon>
            <ListItemText primary="Søker..." />
          </ListItem>
        ) : (
          suggestions.map((suggestion, index) => {
            const { resource } = suggestion;
            const isSelected = index === selectedIndex;
            const color = getResourceColor(resource.type) as any;

            return (
              <ListItem
                key={`${resource.type}-${resource.id}`}
                button
                selected={isSelected}
                onClick={() => handleSelect(suggestion)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText', '&:hover': {
                      backgroundColor: 'primary.dark',
                  },
                }, '&:hover': {
                    backgroundColor: 'action.hover',
                }}}
              >
                <ListItemIcon sx={{ minWidth: 40}}>
                  <Avatar
                    sx={{
                      width:  24,
                      height:  24,
                      backgroundColor: `${color}.main`,
                      color: `${color}.contrastText`}}
                  >
                    {getResourceIcon(resource.type)}
                  </Avatar>
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Box>
                      <Typography
                        variant="body2"
                        fontWeight={isSelected ? 600 : 500}
                        dangerouslySetInnerHTML={{
                          __html: suggestion.highlightedTitle}}
                      />
                      {resource.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp:  2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'}}
                        >
                          {resource.description}
                        </Typography>
                      )}
                    </Box>
                }
                  secondary={
                    <Box sx={{ mt: 0.5}}>
                      {/* Category and Path */}
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5}}>
                        {resource.category && (
                          <Chip
                            size="small"
                            label={resource.category}
                            icon={getCategoryIcon(resource.category)}
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20}}
                          />
                        )}
                        {resource.path && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {resource.path}
                          </Typography>
                        )}
                      </Stack>

                      {/* Tags */}
                      {resource.tags && resource.tags.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap', mb: 0.5}}>
                          {resource.tags.slice(0, 3).map(tag => (
                            <Chip
                              key={tag}
                              size="small"
                              label={tag}
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18}}
                            />
                          ))}
                          {resource.tags.length > 3 && (
                            <Chip
                              size="small"
                              label={`+${resource.tags.length - 3}`}
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18}}
                            />
                          )}
                        </Box>
                      )}

                      {/* Context */}
                      {suggestion.context && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {suggestion.context}
                        </Typography>
                      )}

                      {/* Last Modified */}
                      {resource.lastModified && (
                        <Typography variant="caption" color="text.secondary">
                          {formatLastModified(resource.lastModified)}
                        </Typography>
                      )}
                    </Box>
                }
                />

                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    {/* Status Indicators */}
                    {resource.isActive === false && (
                      <Tooltip title="Inaktiv">
                        <Chip
                          size="small"
                          label="Inaktiv"
                          color="error"
                          sx={{ fontSize: '0.6rem', height: 18}}
                        />
                      </Tooltip>
                    )}

                    {/* Match Score Indicator */}
                    {suggestion.matchScore > 5 && (
                      <Tooltip title={`Match score: ${suggestion.matchScore}`}>
                        <Chip
                          size="small"
                          label="Best match"
                          color="success"
                          sx={{ fontSize: '0.6rem', height: 18}}
                        />
                      </Tooltip>
                    )}

                    {/* Open in new tab */}
                    {resource.path && (
                      <Tooltip title="Åpne i ny fane">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(resource.path, '_blank');
                        }}
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            );
        })
        )}
      </List>

      {/* Footer with instructions */}
      {suggestions.length > 0 && (
        <Box
          sx={{
            p:  1,
            borderTop:  1,
            borderColor: 'divider',
            backgroundColor: 'background.default'}}
        >
          <Typography variant="caption" color="text.secondary">
            Bruk ↑↓ for å navigere, Enter for å velge, Esc for å lukke
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
