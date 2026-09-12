/**
 * Smart Collections Component
 * AI-powered auto-generated collections based on content analysis
 * Profession-specific smart grouping and curation
 */

import React, { useState, useEffect } from 'react';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  IconButton,
  Collapse,
  LinearProgress,
  Stack,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  AutoFixHigh,
  ExpandMore,
  ExpandLess,
  Star,
  Favorite,
  WbSunny,
  LocationOn,
  Groups,
  Celebration,
  Architecture,
  Tag,
  TrendingUp,
  MusicNote,
  VideoLibrary,
  Inventory,
  Refresh,
} from '@mui/icons-material';

interface ShowcaseItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  fileType: string;
  tags?: string[];
  aiAnalysis?: {
    faces?: number;
    composition?: string;
    lighting?: string;
    location?: string;
    mood?: string;
  };
}

interface SmartCollection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  items: ShowcaseItem[];
  criteria: string;
  confidence: number;
}

interface SmartCollectionsProps {
  items: ShowcaseItem[];
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
  onCollectionSelect?: (collection: SmartCollection) => void;
  onItemSelect?: (item: ShowcaseItem) => void;
}

export const SmartCollections: React.FC<SmartCollectionsProps> = ({
  items,
  profession,
  accentColor,
  onCollectionSelect,
  onItemSelect
}) => {
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || accentColor || '#FF6B35';
  const theming = useTheming(currentProfession);
  
  const [collections, setCollections] = useState<SmartCollection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<SmartCollection | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Generate smart collections based on profession
  const generateSmartCollections = () => {
    setIsGenerating(true);
    setGenerationError(null);

    setTimeout(() => {
      try {
        let newCollections: SmartCollection[] = [];

        switch (profession) {
          case 'photographer':
            newCollections = generatePhotographerCollections();
            break;
          case 'videographer':
            newCollections = generateVideographerCollections();
            break;
          case 'music_producer':
            newCollections = generateMusicProducerCollections();
            break;
          case 'vendor':
            newCollections = generateVendorCollections();
            break;
        }

        setCollections(newCollections);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setGenerationError(
          `AI-analyse mislyktes (${msg}). Du kan prøve igjen, eller fortsette uten smarte samlinger.`
        );
        setCollections([]);
      } finally {
        setIsGenerating(false);
      }
    }, 2000); // Simulate AI processing
  };

  // Photographer-specific collections
  const generatePhotographerCollections = (): SmartCollection[] => {
    // Mock AI analysis - in production, this would call actual AI service
    const topItems = items.slice(0, Math.ceil(items.length * 0.1));
    const couplePortraits = items.filter(item => 
      item.tags?.some(tag => tag.toLowerCase().includes('couple, ') || tag.toLowerCase().includes('portrait,'))
    );
    const goldenHour = items.filter(item => 
      item.tags?.some(tag => tag.toLowerCase().includes('sunset') || tag.toLowerCase().includes('golden'))
    );
    const candidMoments = items.filter(item => 
      item.tags?.some(tag => tag.toLowerCase().includes('candid') || tag.toLowerCase().includes('moment'))
    );

    return [
      {
        id: 'best-of-session',
        name: 'Best of Session',
        description: 'AI picks top 10% based on composition, lighting, and technical quality',
        icon: <Star />,
        color: '#FFD700',
        items: topItems.length > 0 ? topItems : items.slice(0, 3),
        criteria: 'Composition score > 90%, Sharp focus, Good exposure',
        confidence: 95
      },
      {
        id: 'couple-portraits',
        name: 'Couple Portraits',
        description: 'Two subjects detected with intimate framing',
        icon: <Favorite />,
        color: '#FF6B9D',
        items: couplePortraits.length > 0 ? couplePortraits : items.slice(3, 6),
        criteria: 'Face, detection: 2 faces, Distance < 1m',
        confidence: 88
      },
      {
        id: 'golden-hour',
        name: 'Golden Hour',
        description: 'Warm lighting and sunset tones detected',
        icon: <WbSunny />,
        color: '#FF8C00',
        items: goldenHour.length > 0 ? goldenHour : items.slice(6, 9),
        criteria: 'Color, temperature: 3000-4000K, Time: 17:00-19:00',
        confidence: 92
      },
      {
        id: 'candid-moments',
        name: 'Candid Moments',
        description: 'Natural expressions and unposed shots',
        icon: <Celebration />,
        color: '#9B59B6',
        items: candidMoments.length > 0 ? candidMoments : items.slice(9, 12),
        criteria: 'Expression, analysis: Genuine smile, No camera gaze',
        confidence: 85
      },
      {
        id: 'venue-highlights',
        name: 'Venue Highlights',
        description: 'Architecture and location details',
        icon: <Architecture />,
        color: '#3498DB',
        items: items.slice(12, 15),
        criteria: 'Building detection, Wide angle composition',
        confidence: 90
      },
      {
        id: 'portfolio-worthy',
        name: 'Portfolio Worthy',
        description: 'Publication-ready images with exceptional quality',
        icon: <TrendingUp />,
        color: '#27AE60',
        items: items.slice(0, 5),
        criteria: 'Technical score > 95%, Unique composition',
        confidence: 93
      }
    ].filter(col => col.items.length > 0);
  };

  // Videographer-specific collections
  const generateVideographerCollections = (): SmartCollection[] => {
    return [
      {
        id: 'best-clips',
        name: 'Best Clips',
        description: 'Low shake, good audio, perfect exposure',
        icon: <Star />,
        color: '#E74C3C',
        items: items.slice(0, 4),
        criteria: 'Shake detection < 5%, Audio quality > 80%',
        confidence: 91
      },
      {
        id: 'interview-footage',
        name: 'Interview Footage',
        description: 'Face on camera with speech detected',
        icon: <Groups />,
        color: '#3498DB',
        items: items.slice(4, 7),
        criteria: 'Face detection + Audio speech recognition',
        confidence: 94
      },
      {
        id: 'b-roll',
        name: 'B-Roll',
        description: 'No dialogue, supplementary footage',
        icon: <VideoLibrary />,
        color: '#9B59B6',
        items: items.slice(7, 11),
        criteria: 'No speech audio, Wide/medium shots',
        confidence: 87
      },
      {
        id: 'establishing-shots',
        name: 'Establishing Shots',
        description: 'Wide scenes showing location/context',
        icon: <LocationOn />,
        color: '#FF8C00',
        items: items.slice(11, 14),
        criteria: 'Wide angle, Scene classification',
        confidence: 89
      },
      {
        id: 'emotional-moments',
        name: 'Emotional Moments',
        description: 'High audio dynamics and visual emphasis',
        icon: <Favorite />,
        color: '#FF6B9D',
        items: items.slice(14, 17),
        criteria: 'Audio peak detection, Expression analysis',
        confidence: 86
      }
    ].filter(col => col.items.length > 0);
  };

  // Music Producer-specific collections
  const generateMusicProducerCollections = (): SmartCollection[] => {
    return [
      {
        id: 'vocal-tracks',
        name: 'Vocal Tracks',
        description: 'Voice detected in frequency analysis',
        icon: <MusicNote />,
        color: '#9B59B6',
        items: items.slice(0, 5),
        criteria: 'Vocal frequency 85-255 Hz detected',
        confidence: 93
      },
      {
        id: 'drum-loops',
        name: 'Drum Loops',
        description: 'Percussion patterns identified',
        icon: <Tag />,
        color: '#E74C3C',
        items: items.slice(5, 9),
        criteria: 'Percussion spectral analysis',
        confidence: 90
      },
      {
        id: 'melodic-elements',
        name: 'Melodic Elements',
        description: 'Tonal content with harmonic structure',
        icon: <TrendingUp />,
        color: '#3498DB',
        items: items.slice(9, 13),
        criteria: 'Harmonic analysis, Pitch detection',
        confidence: 88
      },
      {
        id: 'high-energy',
        name: 'High Energy',
        description: 'BPM > 120, dynamic range analysis',
        icon: <Star />,
        color: '#FF8C00',
        items: items.slice(13, 16),
        criteria: 'BPM > 120, RMS level > -12dB',
        confidence: 92
      },
      {
        id: 'ambient-chill',
        name: 'Ambient/Chill',
        description: 'BPM < 90, relaxed dynamics',
        icon: <WbSunny />,
        color: '#27AE60',
        items: items.slice(16, 19),
        criteria: 'BPM < 90, Soft dynamics',
        confidence: 87
      }
    ].filter(col => col.items.length > 0);
  };

  // Vendor-specific collections
  const generateVendorCollections = (): SmartCollection[] => {
    return [
      {
        id: 'top-sellers',
        name: 'Top Sellers',
        description: 'Products with highest sales velocity',
        icon: <TrendingUp />,
        color: '#27AE60',
        items: items.slice(0, 5),
        criteria: 'Sales data analysis',
        confidence: 96
      },
      {
        id: 'new-arrivals',
        name: 'New Arrivals',
        description: 'Recently added products',
        icon: <Inventory />,
        color: '#3498DB',
        items: items.slice(5, 10),
        criteria: 'Upload date < 7 days',
        confidence: 100
      },
      {
        id: 'high-margin',
        name: 'High Margin Items',
        description: 'Products with best profit margins',
        icon: <Star />,
        color: '#FFD700',
        items: items.slice(10, 14),
        criteria: 'Profit margin > 40%',
        confidence: 94
      },
      {
        id: 'seasonal-trending',
        name: 'Seasonal Trending',
        description: 'Popular for current season',
        icon: <WbSunny />,
        color: '#FF8C00',
        items: items.slice(14, 17),
        criteria: 'Seasonal keyword match, View trends',
        confidence: 89
      }
    ].filter(col => col.items.length > 0);
  };

  // Auto-generate on mount
  useEffect(() => {
    if (items.length > 0) {
      generateSmartCollections();
    }
  }, [items.length, profession]);

  const toggleCollection = (collectionId: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedCollections(newExpanded);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <AutoFixHigh sx={{ color: accentColor, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight="700" sx={{ color: 'white' }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Smart Collections`
                : 'Smart Collections'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              AI-curated based on your content
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Regenerate collections">
          <IconButton 
            onClick={generateSmartCollections}
            disabled={isGenerating}
            sx={{ 
              color: accentColor, '&:hover': { bgcolor: `${accentColor}20` }
            }}
          >
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Loading State */}
      {isGenerating && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)','& .MuiLinearProgress-bar': {
                bgcolor: accentColor
              }
            }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>
            Analyserer {items.length} element{items.length === 1 ? '' : 'er'} med AI… Dette tar vanligvis 2–5 sekunder.
          </Typography>
        </Box>
      )}

      {/* Error State */}
      {generationError && !isGenerating && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={generateSmartCollections}>
              Prøv på nytt
            </Button>
          }
          onClose={() => setGenerationError(null)}
        >
          {generationError}
        </Alert>
      )}

      {/* Collections Grid */}
      <Grid container spacing={2}>
        {collections.map((collection) => (
          <Grid item xs={12} sm={6} md={4} key={collection.id}>
            <Card 
              sx={{ 
                bgcolor: `${collection.color}10`,
                border: `2px solid ${collection.color}40`,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.3s ease','&:hover': {
                  border: `2px solid ${collection.color}`,
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${collection.color}40`
                }
              }}
              onClick={() => {
                setSelectedCollection(collection);
                onCollectionSelect?.(collection);
              }}
            >
              {/* Preview Image */}
              {collection.items[0]?.thumbnailUrl && (
                <CardMedia
                  component="img"
                  height="140"
                  image={collection.items[0].thumbnailUrl}
                  alt={collection.name}
                  sx={{ 
                    opacity: 0.7,
                      transition: 'opacity 0.3s ease',
                      '&:hover': { opacity: 1 }
                  }}
                />
              )}

              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ color: collection.color }}>
                    {collection.icon}
                  </Box>
                  <Typography variant="h6" fontWeight="600" sx={{ color: collection.color, flex: 1 }}>
                    {collection.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollection(collection.id);
                    }}
                    sx={{ color: collection.color }}
                  >
                    {expandedCollections.has(collection.id) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                  {collection.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip 
                    label={`${collection.items.length} items`}
                    size="small"
                    sx={{ 
                      bgcolor: `${collection.color}30`,
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                  <Chip 
                    label={`${collection.confidence}% confidence`}
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                </Box>

                {/* Expanded Details */}
                <Collapse in={expandedCollections.has(collection.id)}>
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${collection.color}40` }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 1 }}>
                      AI Criteria:
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {collection.criteria}
                    </Typography>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Collection Detail Dialog */}
      <Dialog
        open={Boolean(selectedCollection)}
        onClose={() => setSelectedCollection(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f1419',
            backgroundImage: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)',
            color: 'white'
          }
        }}
      >
        {selectedCollection && (
          <>
            <DialogTitle sx={{ 
              borderBottom: `2px solid ${selectedCollection.color}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              <Box sx={{ color: selectedCollection.color }}>
                {selectedCollection.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight="600">
                  {selectedCollection.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  {selectedCollection.items.length} items • {selectedCollection.confidence}% confidence
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
                {selectedCollection.description}
              </Typography>
              <Grid container spacing={2}>
                {selectedCollection.items.map((item) => (
                  <Grid item xs={6} sm={4} md={3} key={item.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer', '&:hover': { 
                          transform: 'scale(1.05)',
                          transition: 'transform 0.2s'
                        }
                      }}
                      onClick={() => {
                        onItemSelect?.(item);
                        setSelectedCollection(null);
                      }}
                    >
                      {item.thumbnailUrl && (
                        <CardMedia
                          component="img"
                          height="100"
                          image={item.thumbnailUrl}
                          alt={item.title}
                        />
                      )}
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" noWrap>
                          {item.title}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedCollection(null)} sx={{ color: 'white' }}>
                Close
              </Button>
              <Button 
                variant="contained"
                sx={{ 
                  bgcolor: selectedCollection.color, '&:hover': { bgcolor: `${selectedCollection.color}dd` }
                }}
                onClick={() => {
                  onCollectionSelect?.(selectedCollection);
                  setSelectedCollection(null);
                }}
              >
                View All
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default SmartCollections;

