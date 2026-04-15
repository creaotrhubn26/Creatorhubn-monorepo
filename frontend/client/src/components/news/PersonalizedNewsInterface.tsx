// @ts-nocheck
/**
 * Personalized News Interface - Equipment-specific news recommendations
 * Material UI implementation with Norwegian localization
 */
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

// Import profession system hooks and utilities
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  Divider,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from '@mui/material';
import {
  Article as NewsIcon,
  Camera as CameraIcon,
  Videocam as VideoIcon,
  LibraryMusic as AudioIcon,
  FlashOn as FlashIcon,
  Lightbulb as LightIcon,
  ExpandMore as ExpandMoreIcon,
  Launch as LaunchIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
} from '@mui/icons-material';

// Interfaces
interface UserEquipment {
  brand: string;
  model: string;
  category: string
}

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishDate: string;
  imageUrl?: string;
  author?: string;
  tags: string[]
}

interface PersonalizedNewsData {
  relevantNews: NewsArticle[];
  brandNews: NewsArticle[];
  categoryNews: NewsArticle[];
  personalizedMessage: string;
  equipmentContext: string
}

interface PersonalizedNewsInterfaceProps {
  userEquipment: UserEquipment[];
  // Integration props for universal workflow connectivity
  profession?: string;
  userId?: string;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

const PersonalizedNewsInterface: React.FC<PersonalizedNewsInterfaceProps> = ({ 
  userEquipment = [],
  profession,
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  const [activeTab, setActiveTab] = useState(false);
  
  // Use dynamic profession system
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters
  const professionAdapter = useProfessionAdapter();
  
  // Get current profession (from prop or dynamic system)
  const currentUserProfession = professionAdapter.profession || profession || 'photographer';
  const currentProfession = currentUserProfession;
  
  // Get profession icon
  const professionIcon = getProfessionIcon(currentProfession);
  
  // Get profession config
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  
  // Get profession color from dynamic system
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

  // Fetch personalized news
  const { data: newsData, isLoading, error, refetch } = useQuery({
    queryKey: ['personalized-news,', userEquipment],
    queryFn: async () => {
      try {
        const response = await fetch('/api/news/personalized', {
          headers: {
            ...auth, 'Content-Type' : 'application/json'
          },
          method: 'POST',
          body: JSON.stringify({ userEquipment })
      });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch personalized news: ${response.status}`);
      }
        
        const data = await response.json();
        console.log('PersonalizedNewsInterface: API response', data);
        return data;
    } catch (error) {
        console.error('PersonalizedNewsInterface: Error fetching news', error);
        throw error;
    }
  },
    enabled: userEquipment && userEquipment.length > 0,
    retry: 1,
    staleTime: 5 * 60 * 1000 // 5 minutes
});

  // Category icons mapping
  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'cameras': <CameraIcon />,
      'video-equipment': <VideoIcon />,
      'audio-equipment': <AudioIcon />,
      'photo-flashes': <FlashIcon />,
      'video-lights': <LightIcon />,
      'general': <NewsIcon />
    };
    return iconMap[category] || <NewsIcon />;
  };

  // Format publish date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Akkurat nå';
    if (diffHours < 24) return `${diffHours}t siden`;
    if (diffHours < 48) return 'I går';
    
    return date.toLocaleDateString('nb-NO', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
});
};

  // Toggle article expansion
  const toggleExpanded = (articleId: string) => {
    const newExpanded = new Set(expandedArticles);
    if (expandedArticles.has(articleId)) {
      newExpanded.delete(articleId);
} else {
      newExpanded.add(articleId);
  }
    setExpandedArticles(newExpanded);
};

  // Render news article card
  const renderArticleCard = (article: NewsArticle, showPersonalizedTag: boolean = false) => (
    <Card 
      key={article.d}
      sx={{
        mb: 2,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        transition: 'all 0.3s ease', '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)'
        },
        ...theming.getThemedCardSx()
      }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap:  2 }}>
          {article.imageUrl && (
            <Avatar 
              src={article.imageUrl}
              sx={{ width:  60, height: 60}}
              variant="rounded"
            >
              {getCategoryIcon(article.category)}
            </Avatar>
          )}
          
          <Box sx={{ flex:  1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                icon={getCategoryIcon(article.category)}
                label={article.category.replace('-', ', ')}
                size="small"
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />
              {showPersonalizedTag && (
                <Chip
                  icon={<StarIcon />}
                  label="Personlig"
                  size="small"
                  color="primary"
                  variant="filled"
                />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {formatDate(article.publishDate)}
              </Typography>
            </Box>
            
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {article.title}
            </Typography>
            
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                display: '-webkit-box',
                WebkitLineClamp: expandedArticles.has(article.id) ? 'none' : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mb: 1 }}
            >
              {article.summary}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {article.source}
              </Typography>
              
              {(article.tags || []).slice(0, 3).map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
              
              <Box sx={{ ml: 'auto', display: 'flex', gap:  1 }}>
                {article.summary.length > 150 && (
                  <IconButton 
                    size="small" 
                    onClick={() => toggleExpanded(article.id)}
                  >
                    <ExpandMoreIcon 
                      sx={{ 
                        transform: expandedArticles.has(article.id) ? 'rotate(180deg)' : 'rotate(0deg, )',
                        transition: 'transform 0.3s'
                  }}
                    />
                  </IconButton>
                )}
                
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<LaunchIcon />}
                  onClick={() => window.open(article.url, '_blank')}
                >
                  Les mer
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml:  2 }}>
          Laster personaliserte nyheter...
        </Typography>
      </Box>
    );
}

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ m:  2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kunne ikke laste nyheter</Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'En ukjent feil oppstod'}
        </Typography>
        <Button variant="outlined" onClick={() => refetch()} sx={{ mt:  1 }}>
          Prøv igjen
        </Button>
      </Alert>
    );
}

  // No equipment state
  if (!userEquipment || userEquipment.length === 0) {
    return (
      <Card sx={{ ...theming.getThemedCardSx(), m: 2, p: 4, textAlign: 'center' }}>
        <NewsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          Personaliserte nyheter
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Legg til utstyret ditt for å få relevante nyheter fra bransjen
        </Typography>
      </Card>
    );
  }

  // Show fallback content if no data is available
  if (!newsData) {
    return (
      <Card sx={{ ...theming.getThemedCardSx(), m: 2 }}>
        <CardContent sx={{ ...theming.getThemedCardSx(), textAlign: 'center', p: 4 }}>
          <NewsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Personaliserte nyheter
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Laster personalisert innhold basert på ditt utstyr...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const tabLabels = [
    { label: `Relevant for deg (${newsData?.relevantNews?.length || 0})`, count: newsData?.relevantNews?.length || 0 },
    { label: `Merke-nyheter (${newsData?.brandNews?.length || 0})`, count: newsData?.brandNews?.length || 0 },
    { label: `Kategori (${newsData?.categoryNews?.length || 0})`, count: newsData?.categoryNews?.length || 0 }
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      {/* Header with personalized message */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)', ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              <StarIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                  ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Personaliserte nyheter`
                  : 'Dine personaliserte nyheter'}
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.92)' }}>
                {newsData?.personalizedMessage || 'Laster personalisert innhold...'}
              </Typography>
              {newsData?.equipmentContext && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.82)' }}>
                  {newsData.equipmentContext}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Equipment summary */}
      {userEquipment && userEquipment.length > 0 && (
        <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Ditt utstyr ({userEquipment.length} enheter)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {userEquipment.map((equipment, index) => (
                <Chip
                  key={index}
                  label={`${equipment?.brand || 'Ukjent'} ${equipment?.model || 'modell'}`}
                  icon={getCategoryIcon(equipment?.category || 'general')}
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* News tabs */}
      <Card sx={theming.getThemedCardSx()}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
          >
            {tabLabels.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                disabled={tab.count === 0}
                sx={{ textTransform: 'none' }}
              />
            ))}
          </Tabs>
        </Box>

        <CardContent sx={{ p: 0,...theming.getThemedCardSx() }}>
          {/* Relevant News Tab */}
          {activeTab === 0 && (
            <Box sx={{ p:  3 }}>
              {newsData?.relevantNews && newsData.relevantNews.length > 0 ? (
                <>
                  <Typography variant="h6" gutterBottom color="primary" sx={{ color: theming.colors.primary }}>
                    📰 Nyheter som kan være viktige for deg
                  </Typography>
                  {newsData.relevantNews.map(article => renderArticleCard(article, true))}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', p:  4 }}>
                  <NewsIcon sx={{ fontSize:  48, color: 'text.secondary', mb:  2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Ingen spesifikke nyheter funnet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vi fant ingen nyheter som er spesifikt relevante for ditt utstyr akkurat nå.
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Brand News Tab */}
          {activeTab === 1 && (
            <Box sx={{ p:  3 }}>
              {newsData?.brandNews && newsData.brandNews.length > 0 ? (
                <>
                  <Typography variant="h6" gutterBottom color="primary" sx={{ color: theming.colors.primary }}>
                    🏷️ Nyheter fra dine merker
                  </Typography>
                  {newsData.brandNews.map(article => renderArticleCard(article))}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', p:  4 }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Ingen merke-nyheter funnet
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Category News Tab */}
          {activeTab === 2 && (
            <Box sx={{ p:  3 }}>
              {newsData?.categoryNews && newsData.categoryNews.length > 0 ? (
                <>
                  <Typography variant="h6" gutterBottom color="primary" sx={{ color: theming.colors.primary }}>
                    📂 Nyheter fra dine kategorier
                  </Typography>
                  {newsData.categoryNews.map(article => renderArticleCard(article))}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', p:  4 }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Ingen kategori-nyheter funnet
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PersonalizedNewsInterface;
