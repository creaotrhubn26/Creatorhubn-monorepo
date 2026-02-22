import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfig } from '@/hooks/useProfessionConfig';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useSnackbar } from 'notistack';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Typography,
  Fab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  StickyNote2 as NotesIcon,
  Add as AddIcon,
  Schedule as TimeIcon,
  Work as ProjectIcon,
  KeyboardArrowUp as UpIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface QuickWorklogAccessProps {
  context: 'email' | 'chat' | 'meeting';
  contextData?: {
    projectId?: string;
    clientName?: string;
    subject?: string;
    meetingId?: string;
};
  variant?: 'fab' | 'button' | 'compact';
  position?: 'bottom-right' | 'top-right' | 'inline';
}

interface WorklogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  timeSpent: number;
  mood?: string;
  nextSteps?: string;
  tags: string[];
  createdAt: string;
  projectId?: string
}

export const QuickWorklogAccess: React.FC<QuickWorklogAccessProps> = ({
  context,
  contextData = {},
  variant = 'fab',
  position = 'bottom-right'
}) => {
  const [open, setOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Profession-specific functionality
  const profession = user?.profession || 'photographer';
  const { config: professionConfig } = useProfessionConfig({ profession });
  const { trackProfessionActivity } = useProfessionAdapter();
  const { enqueueSnackbar } = useSnackbar();
  
  // Theming system
  const theming = useTheming();
  
  // Track worklog access activity
  useEffect(() => {
    trackProfessionActivity('quick_worklog_accessed', { context, variant });
  }, [context, variant, trackProfessionActivity]);

  // Helper functions (defined before mutations)
  const getContextTitle = () => {
    switch (context) {
      case 'email':
        return `E-post: ${contextData.subject || contextData.clientName || 'Ukjent'}`;
      case 'chat':
        return `Chat: ${contextData.clientName || 'Samtale'}`;
      case 'meeting':
        return `Møte: ${contextData.clientName || 'Møte'}`;
      default: return 'Lynnotat';
    }
  };

  const getContextIcon = () => {
    switch (context) {
      case 'email': return <NotesIcon />;
      case 'chat': return <TimeIcon />;
      case 'meeting': return <ProjectIcon />;
      default: return <NotesIcon />;
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'bottom-right':
        return {
          position: 'fixed' as const,
          bottom:  90,
          right:  20,
          zIndex: 1300
        };
      case 'top-right':
        return {
          position: 'fixed' as const,
          top:  20,
          right:  20,
          zIndex: 1300
        };
      default: return {};
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + W = Quick worklog
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'W') {
        event.preventDefault();
        setQuickNoteOpen(true);
        console.log('🔥 Worklog shortcut activated: Ctrl+Shift+W, ');
  }
      
      // Ctrl/Cmd + Shift + N = Open full worklog
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
        event.preventDefault();
        setOpen(true);
        console.log('🔥 Worklog overview shortcut: Ctrl+Shift+N, ');
  }
      
      // Ctrl/Cmd + K = Toggle compact view
      if ((event.ctrlKey || event.metaKey) && event.key === 'k' && variant === 'compact') {
        event.preventDefault();
        setExpanded(!expanded);
        console.log('🔥 Toggle worklog widget: Ctrl+K, ');
  }
      
      // ESC = Close dialogs
      if (event.key === 'Escape') {
        if (quickNoteOpen) {
          setQuickNoteOpen(false);
      } else if (open) {
          setOpen(false);
      }
    }
  };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
}, [quickNoteOpen, open, expanded, variant]);

  // Fetch recent worklog entries
  const { data: recentEntries = [] } = useQuery({
    queryKey: ['/api/worklog/recent', context],
    queryFn: () => apiRequest('/api/worklog/recent', {
      headers: {
  }
  }),
    enabled: open
});

  // Quick note mutation with Google Keep sync
  const quickNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const contextTitle = getContextTitle();
      const worklogEntry = {
        title: `${contextTitle} - Lynnotat`,
        description: note,
        timeSpent:  5, // 5 minutes default
        category: context,
        day: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        projectId: contextData.projectId,
        tags: [context, 'lynnotat'],
        metadata: {
          context,
          contextData,
          createdFrom: 'quick-access',
          syncToKeep: true // Enable Google Keep sync
    }
    };

      // Create worklog entry
      const response = await apiRequest('/api/worklog/entries', {
        method: 'POST',
        body: JSON.stringify(worklogEntry)
      });

      // Sync to Google Keep
      try {
        await apiRequest('/api/google-keep/sync-worklog', {
          method: 'POST',
          body: JSON.stringify({
            entries: [worklogEntry]
          })
        });
        console.log('✅ Worklog synced to Google Keep');
    } catch (keepError) {
        console.warn('⚠️ Google Keep sync failed: ', keepError);
    }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/worklog'] });
      enqueueSnackbar('Lynnotat lagret! 📝', { variant: 'success' });
      setQuickNote('');
      setQuickNoteOpen(false);
    },
    onError: (error: Error) => {
      console.error('Failed to create quick note:', error);
      enqueueSnackbar('Kunne ikke lagre notat', { variant: 'error' });
    }
  });

  const renderCompactView = () => (
    <Paper
      elevation={expanded ? 8 : 4}
      sx={{
        ...getPositionStyles(),
        width: expanded ? 300 : 60,
        height: expanded ? 400 : 60,
        borderRadius: expanded ? 2 : '50%',
        transition: 'all 0.3s ease',
        background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
        overflow: 'hidden',
        ...theming.getThemedCardSx()
      }}
    >
      {!expanded ? (
        <Fab
          size="medium"
          onClick={() => setExpanded(true)}
          sx={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            boxShadow: 'none',
            '&:hover': {
              background: 'rgba(255,255,255,0.1)'
            }
          }}
        >
          <NotesIcon sx={{ color: 'white' }} />
        </Fab>
      ) : (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
            <Typography variant="h6" sx={{  color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 1  }}>
              {getContextIcon()} {professionConfig?.name || 'Worklog'}
            </Typography>
            <Button
              size="small"
              onClick={() => setExpanded(false)}
              sx={{ minWidth: 'auto', p: 0,color: 'white' }}
            >
              <UpIcon />
            </Button>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', mb:  2 }}>
            <List dense>
              {recentEntries.slice(0, 3).map((entry: WorklogEntry) => (
                <ListItem key={entry.id} dense>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ color: 'white', fontSize: '12px' }}>
                        {entry.title}
                      </Typography>
                  }
                    secondary={
                      <Typography variant="caption" sx={{ color: 'rgba(25,255,255,0.7)' }}>
                        {entry.timeSpent}min • {entry.category}
                      </Typography>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Box sx={{ display: 'flex', gap:  1 }}>
            <Button variant="contained"
              size="small"
              onClick={() => setQuickNoteOpen(true)}
              sx={{
                flex:  1,
                bgcolor: 'rgba(25,255,255,0.2)',
                color: 'white',
                fontSize: '11px','&:hover': {
                  bgcolor: 'rgba(25,255,255,0.3)'
              }
            }}
            >
              + Notat
            </Button>
            <Button variant="contained"
              size="small"
              onClick={() => setOpen(true)}
              sx={{
                flex:  1,
                bgcolor: 'rgba(25,255,255,0.2)',
                color: 'white',
                fontSize: '11px','&:hover': {
                  bgcolor: 'rgba(25,255,255,0.3)'
              }
            }}
            >
              Alle
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );

  const renderFabView = () => (
    <Tooltip title={`Worklog-notater (${context}) • Ctrl+Shift+W for lynnotat`}>
      <Fab
        color="secondary"
        onClick={() => setOpen(true)}
        sx={{
          ...getPositionStyles(),
          background: 'linear-gradient(135deg, #ff6b35, #f7931e)','&:hover': {
            background: 'linear-gradient(135deg, #e55a2b, #e8841a)'
        }
      }}
      >
        <NotesIcon />
      </Fab>
    </Tooltip>
  );

  const renderButtonView = () => (
    <Button
      variant="outlined"
      startIcon={<NotesIcon />}
      onClick={() => setOpen(true)}
      sx={{
        borderColor: '#ff6b30',
        color: '#ff6b30','&:hover': {
          borderColor: '#e55a20',
          bgcolor: 'rgba(25, 107, 53, 0.1)'
      }
    }}
    >
      Worklog-notater
    </Button>
  );

  return (
    <>
      {/* Render based on variant */}
      {variant === 'compact' && renderCompactView()}
      {variant === 'fab' && renderFabView()}
      {variant === 'button' && renderButtonView()}

      {/* Quick Note Dialog */}
      <Dialog open={quickNoteOpen} onClose={() => setQuickNoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <NotesIcon sx={{ color: '#ff6b35' }} />
          Lynnotat fra {context}
          <Chip 
            label="Ctrl+Shift+W" 
            size="small" 
            sx={{ 
              ml: 'auto', 
              bgcolor: 'rgba(25,107,53,0.1)', 
              color: '#ff6b30',
              fontSize: '0.7rem' 
        }}
          />
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb:  2 }}>
            <Typography variant="body2" color="textSecondary">
              {getContextTitle()}
            </Typography>
            <Typography variant="caption" sx={{ color: '#4285f0', display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              📝 Synkroniseres automatisk til Google Keep
            </Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Skriv en rask notat... (Ctrl+Enter for å lagre)"
            variant="outlined"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && quickNote.trim()) {
                e.preventDefault();
                quickNoteMutation.mutate(quickNote);
            }
          }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickNoteOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={() => quickNoteMutation.mutate(quickNote)}
            disabled={!quickNote.trim() || quickNoteMutation.isPending}
            sx={{
              background: 'linear-gradient(135deg, #ff6b35, #f7931e)','&:hover': {
                background: 'linear-gradient(135deg, #e55a2b, #e8841a)'
            }
          }}
          >
            {quickNoteMutation.isPending ? 'Lagrer...' : 'Lagre notat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full Worklog Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <NotesIcon sx={{ color: '#ff6b35' }} />
          Worklog-notater ({context})
          <Box sx={{ ml: 'auto', display: 'flex', gap:  1 }}>
            <Chip
              label={`${recentEntries.length} oppføringer`}
              size="small"
            />
            <Chip 
              label="Ctrl+Shift+N" 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(25,107,53,0.1)', 
                color: '#ff6b30',
                fontSize: '0.7rem' 
          }}
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb:  3 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb:  2 }}>
              Kontekst: {getContextTitle()}
            </Typography>
            
            <Button variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setQuickNoteOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #ff6b35, #f7931e)', '&:hover': {
                  background: 'linear-gradient(135deg, #e55a2b, #e8841a)'
              }
            }}
            >
              Nytt lynnotat
            </Button>
          </Box>

          <List>
            {recentEntries.map((entry: WorklogEntry, index: number) => (
              <React.Fragment key={entry.id}>
                <ListItem>
                  <ListItemIcon>
                    {entry.category === 'email' && '📧'}
                    {entry.category === 'chat' && '💬'}
                    {entry.category === 'meeting' && '🏢'}
                    {entry.category === 'general' && '📝'}
                  </ListItemIcon>
                  <ListItemText
                    primary={entry.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" component="span">
                          {entry.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Chip
                            label={`${entry.timeSpent}min`}
                            size="small"
                            icon={<TimeIcon />}
                          />
                          <Chip
                            label={entry.category}
                            size="small"
                            variant="outlined"
                          />
                          {entry.projectId && (
                            <Chip
                              label="Prosjekt koblet"
                              size="small"
                              icon={<ProjectIcon />}
                            />
                          )}
                          {entry.tags.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                  }
                  />
                </ListItem>
                {index < recentEntries.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            {recentEntries.length === 0 && (
              <Box sx={{ textAlign: 'center', py:  4 }}>
                <Typography variant="body2" color="textSecondary">
                  Ingen worklog-oppføringer ennå.
                </Typography>
              </Box>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            Lukk
          </Button>
          <Button variant="contained"
            onClick={() => {
              // Navigate to full worklog
              window.location.hash = '#worklog';
              setOpen(false);
          }}
            sx={{
              background: 'linear-gradient(135deg, #ff6b35, #f7931e)','&:hover': {
                background:'linear-gradient(135deg, #e55a2b, #e8841a)'
            }
          }}
          >
            Åpne full worklog
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};