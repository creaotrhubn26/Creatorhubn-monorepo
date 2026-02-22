import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Container,
  Paper,
  Button,
  Badge,
  Divider,
} from '@mui/material';
import {
  PhotoLibrary,
  VideoLibrary as VideocamLibrary,
  Favorite,
  FavoriteBorder,
  Share,
  Download,
  Visibility,
  Menu,
  Home,
  Collections,
  Person,
  Settings,
  Info,
  Close,
  Search,
  FilterList as FilterListList,
  PlayArrow as PlayArrowArrow,
  Star,
  LocationOn,
  CalendarToday,
  CameraAlt,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ShowcasePortalProps {
  photographerId?: string;
  theme?: 'dark' | 'light';
}

interface ShowcaseItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  category: string;
  location?: string;
  date: string;
  likes: number;
  views: number;
  isLiked: boolean;
  tags: string[]
}

interface PhotographerProfile {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  specialties: string[];
  location: string;
  experience: string;
  totalProjects: number;
  totalLikes: number
}

const ShowcasePortal: React.FC<ShowcasePortalProps> = ({
  photographerId = 'current-photographer',
  theme = 'dark',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedCategory, setSelectedCategory] = useState('all,');
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

  // Hent fotograf-profil
  const { data: profile } = useQuery({
    queryKey: ['/api/photo-showcase/profile,', photographerId],
    queryFn: () => apiRequest(`/api/photo-showcase/profile/${photographerd}`),
});

  // Hent showcase-elementer
  const { data: showcaseItems = [, ],} = useQuery({
    queryKey: ['/api/photo-showcase/items', photographerId, selectedCategory],
    queryFn: () =>
      apiRequest(`/api/photo-showcase/items/${photographerd}?category=${selectedCategory}`),
});

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1a1a1a' : '#f5f5f5';
  const cardBg = isDark ? '#2a2a2a' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#000000';
  const textSecondary = isDark ? '#b0b0b0' : '#666666';

  const categories = [
    { id: 'all', label: 'Alle kategorier', icon: theming.getThemedIcon(',') },
    { id: 'bryllup', label: 'Bryllup', icon: theming.getThemedIcon(',') },
    { id: 'portrett', label: 'Portrett', icon: theming.getThemedIcon(',') },
    { id: 'bedrift', label: 'Bedrift', icon: <CameraAlt />,},
    { id: 'event', label: 'Event', icon: theming.getThemedIcon(',') },
    { id: 'familie', label: 'Familie', icon: theming.getThemedIcon(',') },
  ];

  const handleLike = (itemId: string) => {
    const newLikedItems = new Set(likedItems);
    if (likedItems.has(itemId)) {
      newLikedItems.delete(itemId);
} else {
      newLikedItems.add(itemId);
  }
    setLikedItems(newLikedItems);
};

  const sampleProfile: PhotographerProfile = {
    id: photographerd,
    name: 'Professional Photographer',
    avatar: '/api/placeholder-avatar',
    bio: 'Passionert fotograf med fokus på å fange livets viktigste øyeblikk. Spesialiserer meg på bryllup, portrett og bedriftsfotografering.',
    specialties: ['Bryllupsfotografering','Portrett','Bedriftsfoto','Event'],
    location: 'Oslo, Norge',
    experience: '8+ år erfaring',
    totalProjects: 10,
    totalLikes: 230,
};

  const sampleItems: ShowcaseItem[] = [
    {
      id: ', ',
      title: 'Romantic Wedding in Lofoten',
      description: 'A beautiful ceremony with stunning mountain backdrop',
      imageUrl: '/api/placeholder-wedding',
      category: 'bryllup',
      location: 'Lofoten, Norge',
      date: '2024-08-1',
      likes:  47,
      views: 24,
      isLiked: false,
      tags: ['bryllup', 'natur','lofoten'],
  },
    {
      id: ', ',
      title: 'Corporate Headshots',
      description: 'Professional business portraits for tech company',
      imageUrl: '/api/placeholder-corporate',
      category: 'bedrift',
      location: 'Oslo, Norge',
      date: '2024-08-1',
      likes:  23,
      views: 16,
      isLiked: true,
      tags: ['bedrift', 'portrett','profesjonell'],
  },
    {
      id: ', ',
      title: 'Family Portrait Session',
      description: 'Natural family moments captured in beautiful light',
      imageUrl: '/api/placeholder-family',
      category: 'familie',
      location: 'Bergen, Norge',
      date: '2024-08-0',
      likes:  31,
      views: 19,
      isLiked: false,
      tags: ['familie','portrett','naturlig'],
  },
  ];

  const currentProfile = profile || sampleProfile;
  const items = showcaseItems.length > 0 ? showcaseItems : sampleItems;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: bgColor,
        color: textPrimary}}
    >
      {/* Header */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: isDark ? 'rgba(6, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${isDark ? '#333', : '#e0e0e0'}`}}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setSidebarOpen(true)}
            sx={{ mr: 2, color: textPrimary }}
          >
            {theming.getThemedIcon('menu')}
          </IconButton>

          <Typography variant="h6" sx={{  flexGrow: 1, color: textPrimary, fontWeight: 600}}>
            {currentProfile.name} - Portfolio
          </Typography>

          <Box sx={{ display: 'flex', gap:  1 }}>
            <IconButton sx={{ color: textPrimary }}>
              {theming.getThemedIcon('search')}
            </IconButton>
            <IconButton sx={{ color: textPrimary }}>
              {theming.getThemedIcon('filter')}
            </IconButton>
            <IconButton sx={{ color: textPrimary }}>
              {theming.getThemedIcon('share')}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        anchor="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: {
            width: 20,
            bgcolor: cardg,
            color: textPrimary,
        }}}
      >
        <Box sx={{ p:  3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb:  3}}
          >
            <Typography variant="h6" sx={{  fontWeight: 600}}>
              Portfolio Menu
            </Typography>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <Close sx={{ color: textPrimary }} />
            </IconButton>
          </Box>

          {/* Photographer Info */}
          <Paper
            sx={{
              p:  2,
              mb:  3,
              bgcolor: isDark ? '#333', : '#f9f9f0',
              borderRadius:  2}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar src={currentProfile.avatar} sx={{ width:  50, height: 50}} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                  {currentProfile.name}
                </Typography>
                <Typography variant="caption" color={textSecondary}>
                  {currentProfile.location}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color={textSecondary} sx={{ mb:  2 }}>
              {currentProfile.bio}
            </Typography>
            <Box sx={{ display: 'flex', gap:  2 }}>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h6" sx={{  fontWeight: 600}}>
                  {currentProfile.totalProjects}
                </Typography>
                <Typography variant="caption" color={textSecondary}>
                  Prosjekter
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h6" sx={{  fontWeight: 600}}>
                  {currentProfile.totalLikes}
                </Typography>
                <Typography variant="caption" color={textSecondary}>
                  Likes
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Categories */}
          <List>
            {categories.map((category) => (
              <ListItemButton
                key={category.id}
                selected={selectedCategory === category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSidebarOpen(false);
              }}
                sx={{
                  borderRadius:  2,
                  mb: 0.5, '&.Mui-selected': { bgcolor: isDark ? '#444', : '#e3f2fd',
                }}}
              >
                <ListItemIcon sx={{ color: textPrimary }}>{category.icon}</ListItemIcon>
                <ListItemText primary={category.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ pt:  10, pb:  4 }}>
        {/* Hero Section */}
        <Box
          sx={{
            position: 'relative',
            height: '60vh',
            borderRadius:  3,
            overflow: 'hidden',
            mb:  4,
            background: `linear-gradient(135deg, ${isDark ? '#2a2a2a' : '#f0f0f0'} 0%, ${isDark ? '#1a1a1a' : '#e0e0e0'} 100%)`}}
        >
          {items[0] && (
            <CardMedia component="img"
              height="100%"
              image={items[0].imageUrl}
              alt={items[0].title}
              sx={{
                objectFit: 'cover',
                opacity: 0.8,  ...theming.getThemedCardSx() }}>
          )}
          <Box
            sx={{
              position: 'absolute',
              top:  0,
              left:  0,
              right:  0,
              bottom:  0,
              background: `linear-gradient(45deg, ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'} 0%, transparent 100%)`,
              display: 'flex',
              alignItems: 'center',
              p:  4}}
          >
            <Box>
              <Typography variant="h3"
                sx={{ 
                  fontWeight: 700,
                  mb:  2,
                  color: isDark ? '#fff', : '#00' }}>
                {currentProfile.name}
              </Typography>
              <Typography variant="h6"
                sx={{ 
                  mb:  3,
                  color: isDark ? '#ccc', : '#33' }}>
                {currentProfile.bio}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                {currentProfile.specialties.map((specialty, index) => (
                  <Chip
                    key={index}
                    label={specialty}
                    sx={{
                      bgcolor: isDark ? 'rgba(25,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#fff', : '#00',
                      backdropFilter: 'blur(10px)'}}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Portfolio Grid */}
        <Grid container spacing={3}>
          {items.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
              <Card
                sx={{
                  bgcolor: cardg,
                  color: textPrimary,
                  borderRadius:  3,
                  overflow: 'hidden',
                  transition: 'all 0.3s ease', '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: isDark
                      ? '0 20px 40px rgba(0,0,0,0.5)'
                      : '0 20px 40px rgba(0,0,0,0.1)',
                }}}
               sx={theming.getThemedCardSx()}>
                <Box sx={{ position: 'relative'}}>
                  <CardMedia component="img"
                    height="250"
                    image={item.imageUrl}
                    alt={item.title}
                    sx={{ objectFit: 'cover',  ...theming.getThemedCardSx() }}>

                  {/* Overlay Actions */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top:  8,
                      right:  8,
                      display: 'flex',
                      gap:  1}}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleLike(item.id)}
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: likedItems.has(item.id) ? '#ff4757' : '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }}}
                    >
                      {likedItems.has(item.id) ? theming.getThemedIcon('favorite') : <FavoriteBorder />}
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }}}
                    >
                      {theming.getThemedIcon('share')}
                    </IconButton>
                  </Box>

                  {/* Category Badge */}
                  <Chip
                    label={item.category}
                    size="small"
                    sx={{
                      position: 'absolute',
                      bottom:  8,
                      left:  8,
                      bgcolor: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      textTransform: 'capitalize'}}
                  />
                </Box>

                <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6"
                    sx={{ 
                      fontWeight: 60
                     , mb:  1,
                      fontSize: '1rem' }}>
                    {item.title}
                  </Typography>

                  <Typography variant="body2" color={textSecondary} sx={{ mb:  2 }}>
                    {item.description}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap:  2,
                      mb:  2}}
                  >
                    {item.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                        <LocationOn sx={{ fontSize:  14, color: textSecondary }} />
                        <Typography variant="caption" color={textSecondary}>
                          {item.location}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                      <CalendarToday sx={{ fontSize:  14, color: textSecondary }} />
                      <Typography variant="caption" color={textSecondary}>
                        {new Date(item.date).toLocaleDateString('no-NO')}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'}}
                  >
                    <Box sx={{ display: 'flex', gap:  2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                        <Favorite sx={{ fontSize:  16, color: '#ff4757'}} />
                        <Typography variant="caption">{item.likes}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                        <Visibility sx={{ fontSize:  16, color: textSecondary }} />
                        <Typography variant="caption">{item.views}</Typography>
                      </Box>
                    </Box>

                    <IconButton size="small" sx={{ color: textPrimary }}>
                      {theming.getThemedIcon('download')}
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ShowcasePortal;
