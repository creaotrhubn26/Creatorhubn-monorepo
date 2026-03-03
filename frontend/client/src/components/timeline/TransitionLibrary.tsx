/**
 * TRANSITION LIBRARY COMPONENT
 * Professional transition picker with 485+ effects
 * Canvas2D (35) + WebGL (450+) transitions
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Badge,
  Alert,
  Stack,
} from '@mui/material';
import {
  Close,
  PlayArrow,
  Check,
  Search,
  Star,
} from '@mui/icons-material';
import { hybridTransitionEngine } from '../../services/hybrid-transition-engine';

interface TransitionLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectTransition: (type: string, duration: number, engine: 'canvas2d' | 'webgl') => void;
}

interface TransitionItem {
  type: string;
  name: string;
  engine: 'canvas2d' | 'webgl';
  category: string;
  duration: number;
  author?: string;
}

interface FeaturedTransitionItem {
  type: string;
  name: string;
  engine: 'canvas2d' | 'webgl';
  reason: string;
}

export default function TransitionLibrary({
  open,
  onClose,
  onSelectTransition
}: TransitionLibraryProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTransition, setPreviewTransition] = useState<string | null>(null);
  const [transitionsByCategory, setTransitionsByCategory] = useState<Map<string, TransitionItem[]>>(new Map());
  const [featuredTransitions, setFeaturedTransitions] = useState<FeaturedTransitionItem[]>([]);
  const [transitionCount, setTransitionCount] = useState({ canvas2d: 0, webgl: 0, total: 0 });

  const loadTransitions = useCallback(() => {
    try {
      const categories = hybridTransitionEngine.getTransitionsByCategory();
      const count = hybridTransitionEngine.getTransitionCount();
      const featured = hybridTransitionEngine.getFeaturedTransitions();

      setTransitionsByCategory(categories);
      setTransitionCount(count);
      setFeaturedTransitions(featured);
      setSelectedTab((previous) => {
        if (categories.size === 0) {
          return 0;
        }
        return Math.min(previous, categories.size - 1);
      });
    } catch (error) {
      console.error('Failed to load transition catalog:', error);
      setTransitionsByCategory(new Map());
      setFeaturedTransitions([]);
      setTransitionCount({ canvas2d: 0, webgl: 0, total: 0 });
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    loadTransitions();
  }, [loadTransitions, open]);

  const categoryNames = useMemo(
    () => Array.from(transitionsByCategory.keys()),
    [transitionsByCategory]
  );

  const filteredTransitions = useMemo(() => {
    if (!searchQuery) {
      return null;
    }
    try {
      return hybridTransitionEngine.searchTransitions(searchQuery);
    } catch (error) {
      console.error('Transition search failed:', error);
      return [];
    }
  }, [searchQuery]);

  const currentCategoryTransitions = useMemo(() => {
    if (categoryNames.length === 0) {
      return [];
    }
    return transitionsByCategory.get(categoryNames[selectedTab]) || [];
  }, [categoryNames, selectedTab, transitionsByCategory]);

  const transitionsToRender = searchQuery ? filteredTransitions || [] : currentCategoryTransitions;

  const handleSelectTransition = useCallback((transition: TransitionItem) => {
    setPreviewTransition(transition.type);
    onSelectTransition(transition.type, transition.duration, transition.engine);
    onClose();
  }, [onClose, onSelectTransition]);
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box>
          <Typography variant="h6">Professional Transition Library</Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {transitionCount.total} transitions • {transitionCount.canvas2d} Canvas2D • {transitionCount.webgl} WebGL
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {/* WebGL Status Alert */}
        {!hybridTransitionEngine.isWebGLAvailable() && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            WebGL not available. Advanced transitions disabled. Using Canvas2D fallback ({transitionCount.canvas2d} transitions).
          </Alert>
        )}
        
        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search transitions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />
        
        {/* Featured Transitions */}
        {!searchQuery && selectedTab === 0 && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Star sx={{ color: '#FFD700' }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Featured Transitions
              </Typography>
            </Stack>
            <Grid container spacing={1}>
              {featuredTransitions.slice(0, 6).map((transition) => (
                <Grid item xs={4} sm={3} md={2} key={transition.type}>
                  <Card sx={{ bgcolor: '#F3F4F6' }}>
                    <CardActionArea
                      onMouseEnter={() => setPreviewTransition(transition.type)}
                      onMouseLeave={() => setPreviewTransition((previous) => (
                        previous === transition.type ? null : previous
                      ))}
                      onClick={() => {
                        onSelectTransition(transition.type, 1.0, transition.engine);
                        onClose();
                      }}
                    >
                      <Box sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" fontWeight={600} noWrap>
                          {transition.name}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {transition.reason}
                        </Typography>
                        <Chip 
                          label={transition.engine === 'webgl' ? 'GPU' : '2D'}
                          size="small"
                          sx={{ 
                            height: 16,
                            fontSize: '0.6rem',
                            mt: 0.5,
                            bgcolor: transition.engine === 'webgl' ? '#667eea' : '#10B981',
                            color: 'white'
                          }}
                        />
                      </Box>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
        
        {/* Tabs for Categories */}
        {!searchQuery && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs 
              value={selectedTab} 
              onChange={(_, v) => setSelectedTab(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {categoryNames.map((catName) => {
                const count = transitionsByCategory.get(catName)?.length || 0;
                return (
                  <Tab 
                    key={catName} 
                    label={
                      <Badge badgeContent={count} color="primary" max={999}>
                        <span>{catName}</span>
                      </Badge>
                    } 
                  />
                );
              })}
            </Tabs>
          </Box>
        )}
        
        {/* Transition Grid */}
        <Grid container spacing={2}>
          {transitionsToRender.map((transition) => (
            <Grid item xs={6} sm={4} md={3} key={transition.type}>
              <Card sx={{
                border: previewTransition === transition.type ? '2px solid #667eea' : 'none',
                cursor: 'pointer',
                bgcolor: transition.engine === 'webgl' ? 'rgba(102, 126, 234, 0.05)' : 'white'
              }}>
                <CardActionArea
                  onMouseEnter={() => setPreviewTransition(transition.type)}
                  onMouseLeave={() => setPreviewTransition((previous) => (
                    previous === transition.type ? null : previous
                  ))}
                  onClick={() => handleSelectTransition(transition)}
                >
                  <Box
                    sx={{
                      height: 100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: transition.engine === 'webgl' ? 'rgba(102, 126, 234, 0.1)' : 'grey.100',
                      position: 'relative'
                    }}
                  >
                    {/* Transition preview */}
                    <Box sx={{
                      width: 50,
                      height: 50,
                      background: transition.engine === 'webgl' 
                        ? 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(45deg, #10B981 0%, #059669 100%)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <PlayArrow sx={{ color: 'white', fontSize: 28 }} />
                    </Box>
                    
                    {/* Engine badge */}
                    <Chip
                      label={transition.engine === 'webgl' ? 'GPU' : '2D'}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        height: 18,
                        fontSize: '0.65rem',
                        bgcolor: transition.engine === 'webgl' ? '#667eea' : '#10B981',
                        color: 'white'
                      }}
                    />
                    
                    {previewTransition === transition.type && (
                      <Chip
                        label="Selected"
                        size="small"
                        icon={<Check />}
                        color="primary"
                        sx={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          height: 18,
                          fontSize: '0.65rem'
                        }}
                      />
                    )}
                  </Box>
                  
                  <CardContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" align="center" noWrap>
                      {transition.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center" display="block">
                      {transition.duration}s
                      {transition.author && transition.author !== 'Built-in' && (
                        <> • {transition.author}</>
                      )}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        {/* No results */}
        {searchQuery && filteredTransitions && filteredTransitions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="body2">
              No transitions found for "{searchQuery}"
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
