/**
 * CreatorHub Norge Community - Advanced Search Dialog
 * 
 * Knowledge-first search with filters, scoping, and smart relevance
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  TextField,
  IconButton,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  CircularProgress,
  InputAdornment,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Badge as MuiBadge,
} from '@mui/material';
import {
  Close,
  Search as SearchIcon,
  FilterList,
  CheckCircle,
  AttachFile,
  Forum,
  Person,
  Tag,
  TrendingUp,
  Bookmark,
  Article,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import {
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_FIELD_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

interface SearchFilters {
  scope: 'all' | 'channel' | 'thread';
  scopeId?: string;
  type: 'all' | 'messages' | 'threads' | 'users' | 'tags';
  hasAttachment?: boolean;
  hasSolution?: boolean;
  fromUser?: string;
  dateRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  sortBy: 'relevance' | 'recent' | 'popular';
}

interface SearchResult {
  id: string;
  type: 'message' | 'thread' | 'user' | 'tag';
  
  // Message/Thread fields
  content?: string;
  snippet?: string;
  highlightedSnippet?: string;
  threadTitle?: string;
  channelId?: string;
  channelName?: string;
  channelIcon?: string;
  
  // User fields
  userName: string;
  userAvatar?: string;
  userRole?: string;
  userRoleColor?: string;
  
  // Metadata
  timestamp?: string;
  replyCount?: number;
  reactionCount?: number;
  
  // Flags
  hasSolution?: boolean;
  hasAttachment?: boolean;
  isThread?: boolean;
  
  // Match info
  matchReason?: string;
  matchScore?: number;
}

interface BookmarkRecord {
  message_id: string;
}

interface AdvancedSearchDialogProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  defaultScope?: 'all' | 'channel' | 'thread';
  defaultScopeId?: string;
  defaultScopeName?: string;
  onSelectMessage?: (messageId: string, channelId: string) => void;
  onSelectThread?: (threadId: string, channelId: string) => void;
  onSelectUser?: (userId: string) => void;
  onSaveResult?: (resultId: string) => void;
  onConvertToArticle?: (messageId: string) => void;
}

export default function AdvancedSearchDialog({
  open,
  onClose,
  currentUserId,
  defaultScope = 'all',
  defaultScopeId,
  defaultScopeName,
  onSelectMessage,
  onSelectThread,
  onSelectUser,
  onSaveResult,
  onConvertToArticle,
}: AdvancedSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    scope: defaultScope,
    scopeId: defaultScopeId,
    type: 'all',
    sortBy: 'relevance',
    dateRange: 'all',
  });

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const debounce = setTimeout(() => {
        performSearch();
      }, 300);
      return () => clearTimeout(debounce);
    } else {
      setResults([]);
    }
  }, [searchQuery, filters]);

  useEffect(() => {
    if (open) {
      fetchBookmarks();
    }
  }, [open]);

  const fetchBookmarks = async () => {
    try {
      const response = (await apiRequest('/api/community/bookmarks')) as {
        bookmarks?: BookmarkRecord[];
      };
      const bookmarkIds = new Set(
        (response.bookmarks ?? []).map((bookmark) => bookmark.message_id),
      );
      setBookmarkedIds(bookmarkIds);
    } catch (error) {
      console.error('Error fetching bookmarks: ', error);
    }
  };

  const performSearch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      params.set('scope', filters.scope);
      params.set('scopeId', filters.scopeId ?? '');
      params.set('type', filters.type);
      params.set('sortBy', filters.sortBy);
      params.set('dateRange', filters.dateRange ?? 'all');

      if (typeof filters.hasAttachment === 'boolean') {
        params.set('hasAttachment', String(filters.hasAttachment));
      }
      if (typeof filters.hasSolution === 'boolean') {
        params.set('hasSolution', String(filters.hasSolution));
      }
      if (filters.fromUser) {
        params.set('fromUser', filters.fromUser);
      }
      
      const response = await apiRequest(`/api/community/search/advanced?${params}`);
      setResults(response.results || []);
    } catch (error) {
      console.error('Error searching: ', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    if (result.type === 'message' && onSelectMessage && result.channelId) {
      onSelectMessage(result.id, result.channelId);
      onClose();
      return;
    }
    if (result.type === 'thread' && onSelectThread && result.channelId) {
      onSelectThread(result.id, result.channelId);
      onClose();
      return;
    }
    if (result.type === 'user' && onSelectUser) {
      onSelectUser(result.id);
      onClose();
      return;
    }
  };

  const renderResultIcon = (result: SearchResult) => {
    if (result.type === 'user') return <Person />;
    if (result.type === 'tag') return <Tag />;
    if (result.isThread) return <Forum />;
    return <SearchIcon />;
  };

  const renderResult = (result: SearchResult) => {
    const isBookmarkable = result.type === 'message' || result.type === 'thread';

    return (
      <Paper
        key={result.id}
        sx={{
          ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
          mb: 2,
          p: 2,
          cursor: 'pointer',
          transition: 'transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            borderColor: 'rgba(245, 166, 35, 0.2)',
            bgcolor: 'rgba(255,255,255,0.05)',
          },
        }}
        onClick={() => handleSelectResult(result)}
      >
        {/* Header: Channel + Metadata */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {result.channelName && (
              <Chip
                label={`# ${result.channelName}`}
                size="small"
                icon={result.channelIcon ? <span>{result.channelIcon}</span> : undefined}
              />
            )}
            {result.hasSolution && (
              <Tooltip title="Har løsning">
                <CheckCircle color="success" fontSize="small" />
              </Tooltip>
            )}
            {result.hasAttachment && (
              <Tooltip title="Har vedlegg">
                <AttachFile fontSize="small" />
              </Tooltip>
            )}
            {result.isThread && (
              <Tooltip title="Tråd">
                <Forum fontSize="small" />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
            {result.timestamp &&
              formatDistanceToNow(new Date(result.timestamp), {
                addSuffix: true,
                locale: nb,
              })}
          </Typography>
        </Box>

        {/* Thread Title or Content Snippet */}
        {result.threadTitle && (
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ color: COMMUNITY_DIALOG_TEXT }}>
            {result.threadTitle}
          </Typography>
        )}

        {/* Highlighted Snippet */}
        {result.highlightedSnippet ? (
          <Typography
            variant="body2"
            sx={{ mb: 1, color: COMMUNITY_DIALOG_MUTED }}
            dangerouslySetInnerHTML={{ __html: result.highlightedSnippet }}
          />
        ) : (
          result.snippet && (
            <Typography variant="body2" sx={{ mb: 1, color: COMMUNITY_DIALOG_MUTED }} noWrap>
              {result.snippet}
            </Typography>
          )
        )}

        {/* Footer: User + Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar src={result.userAvatar} sx={{ width: 24, height: 24 }}>
              {result.userName?.[0]}
            </Avatar>
            <Typography variant="caption" fontWeight={600} sx={{ color: COMMUNITY_DIALOG_TEXT }}>
              {result.userName}
            </Typography>
            {result.userRole && (
              <Chip
                label={result.userRole}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: result.userRoleColor || 'primary.main',
                  color: 'white'}}
              />
            )}
          </Box>

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {result.isThread && (
              <Tooltip title="Åpne i tråd">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleSelectResult(result); }}>
                  <Forum fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onSaveResult && isBookmarkable && (
              <Tooltip title={bookmarkedIds.has(result.id) ? 'Fjern bokmerke' : 'Lagre'}>
                <IconButton
                  size="small"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      if (bookmarkedIds.has(result.id)) {
                        await apiRequest(`/api/community/bookmarks/${result.id}`, { method: 'DELETE' });
                        setBookmarkedIds(prev => {
                          const next = new Set(prev);
                          next.delete(result.id);
                          return next;
                        });
                      } else {
                        await apiRequest('/api/community/bookmarks', {
                          method: 'POST',
                          body: JSON.stringify({
                            userId: currentUserId,
                            messageId: result.id
                          }),
                        });
                        setBookmarkedIds(prev => new Set(prev).add(result.id));
                      }
                      onSaveResult(result.id);
                    } catch (error) {
                      console.error('Error toggling bookmark:', error);
                    }
                  }}
                  color={bookmarkedIds.has(result.id) ? 'primary' : 'default'}
                >
                  <Bookmark fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onConvertToArticle && result.type === 'message' && (
              <Tooltip title="Konverter til artikkel">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onConvertToArticle(result.id); }}>
                  <Article fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Match Reason */}
        {result.matchReason && (
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#ffd27a' }}>
            💡 {result.matchReason}
          </Typography>
        )}
      </Paper>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={COMMUNITY_DIALOG_SX}
      PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
    >
      <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon sx={{ color: '#ffd27a' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
              Søk i CreatorHub Norge
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
        {/* Search Input */}
        <TextField
          fullWidth
          autoFocus
          placeholder="Søk etter meldinger, tråder, brukere, emner..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Filtre">
                  <IconButton onClick={() => setShowFilters(!showFilters)} size="small">
                    <MuiBadge color="primary" variant="dot" invisible={!showFilters}>
                      <FilterList />
                    </MuiBadge>
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            )}}
          sx={{ ...COMMUNITY_DIALOG_FIELD_SX, mb: 2 }}
        />

        {/* Scope Indicator */}
        {filters.scope !== 'all' && defaultScopeName && (
          <Box sx={{ mb: 2 }}>
            <Chip
              label={`Søker i: ${defaultScopeName}`}
              onDelete={() => setFilters({ ...filters, scope: 'all', scopeId: undefined })}
              color="primary"
              variant="outlined"
            />
          </Box>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <Paper sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filtre
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* Type Filter */}
              <FormControl size="small" sx={{ minWidth: 150, ...COMMUNITY_DIALOG_FIELD_SX }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type}
                  label="Type"
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="messages">Meldinger</MenuItem>
                  <MenuItem value="threads">Tråder</MenuItem>
                  <MenuItem value="users">Brukere</MenuItem>
                  <MenuItem value="tags">Emner</MenuItem>
                </Select>
              </FormControl>

              {/* Date Range */}
              <FormControl size="small" sx={{ minWidth: 150, ...COMMUNITY_DIALOG_FIELD_SX }}>
                <InputLabel>Tidsperiode</InputLabel>
                <Select
                  value={filters.dateRange}
                  label="Tidsperiode"
                  onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="day">Siste dag</MenuItem>
                  <MenuItem value="week">Siste uke</MenuItem>
                  <MenuItem value="month">Siste måned</MenuItem>
                  <MenuItem value="year">Siste år</MenuItem>
                </Select>
              </FormControl>

              {/* Sort By */}
              <FormControl size="small" sx={{ minWidth: 150, ...COMMUNITY_DIALOG_FIELD_SX }}>
                <InputLabel>Sorter etter</InputLabel>
                <Select
                  value={filters.sortBy}
                  label="Sorter etter"
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                >
                  <MenuItem value="relevance">Relevans</MenuItem>
                  <MenuItem value="recent">Nyeste</MenuItem>
                  <MenuItem value="popular">Populære</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Toggle Filters */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="Har løsning"
                icon={<CheckCircle />}
                onClick={() => setFilters({ ...filters, hasSolution: !filters.hasSolution })}
                color={filters.hasSolution ? 'success' : 'default'}
                variant={filters.hasSolution ? 'filled' : 'outlined'}
              />
              <Chip
                label="Har vedlegg"
                icon={<AttachFile />}
                onClick={() => setFilters({ ...filters, hasAttachment: !filters.hasAttachment })}
                color={filters.hasAttachment ? 'primary' : 'default'}
                variant={filters.hasAttachment ? 'filled' : 'outlined'}
              />
            </Box>
          </Paper>
        )}

        {/* Results */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#f5a623' }} />
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, textAlign: 'center', py: 4 }}>
            <SearchIcon sx={{ fontSize: 60, color: COMMUNITY_DIALOG_MUTED, mb: 2 }} />
            <Typography variant="h6" sx={{ color: COMMUNITY_DIALOG_MUTED }} gutterBottom>
              {searchQuery.trim().length < 2
                ? 'Skriv minst 2 tegn for å søke' : 'Ingen resultater funnet'}
            </Typography>
            {searchQuery.trim().length >= 2 && (
              <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Prøv å justere søkeordene eller filtrene dine
              </Typography>
            )}
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, color: COMMUNITY_DIALOG_MUTED }}>
              {results.length} resultat{results.length !== 1 ? 'er' :','}
            </Typography>
            {results.map((result) => renderResult(result))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
