/**
 * Enhanced Client Showcase
 * Wired into UniversalShowcase with clientMode=true
 * Custom dark-themed sidebar wrapper for brand consistency
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'wouter';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Avatar,
} from '@mui/material';
import {
  Home,
  LocalFireDepartment,
  GridView,
  FavoriteBorderOutlined,
  VideoLibraryOutlined,
} from '@mui/icons-material';
import WeddingCodeEntry from '@/components/wedding-code-entry';
import UniversalShowcase from '@/components/universal/UniversalShowcase';
import { useTheming } from '@/utils/theming-helper';
import { FileManagementStatusProvider } from '@/contexts/FileManagementStatusContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { RealTimeProvider } from '@/contexts/RealTimeContext';

// Base dark theme colors - accent colors will be derived from profession theming
const baseDarkTheme = {
  bg: '#191c19',           // Main background
  sidebar: '#1e211e',      // Sidebar background
  card: '#252825',         // Card background
  text: '#ffffff',         // Primary text
  textSecondary: '#8b8f8b', // Secondary/muted text
  textMuted: '#6b6f6b',    // Very muted text
  navActive: '#252825',    // Active nav item background
};

// Sidebar navigation items - matching the reference design
const sidebarNavItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'popular', label: 'Popular', icon: LocalFireDepartment },
  { id: 'categories', label: 'Categories', icon: GridView },
  { id: 'favorites', label: 'Favorites', icon: FavoriteBorderOutlined },
  { id: 'your-videos', label: 'Your videos', icon: VideoLibraryOutlined },
];

// Demo subscriptions for sidebar
const demoSubscriptions = [
  { name: 'Yoga with Kim', avatar: 'Y' },
  { name: 'Books Review', avatar: 'B' },
  { name: 'Brittany Bathgate', avatar: 'B' },
  { name: 'Ginger Dog', avatar: 'G' },
  { name: 'Asian Recipies', avatar: 'A' },
];

export default function ShowcaseClientEnhanced() {
  const { projectId } = useParams<{ projectId: string }>();

  // Get profession-based theming colors
  const theming = useTheming('videographer');

  // Combine base dark theme with profession-based accent colors
  const darkTheme = useMemo(() => ({
    ...baseDarkTheme,
    accent: theming.colors.primary,
    accentDark: theming.colors.dark,
  }), [theming.colors]);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('home');

  // Get token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      setAccessToken(urlToken);
    }
  }, []);

  // Extract session info from token (if available)
  const sessionId = accessToken ? `session-${projectId}` : undefined;
  const clientEmail = accessToken ? 'client@example.com' : undefined; // Would be extracted from token in production

  // For demo mode, use 'demo-user' as the showcase owner userId
  // In production, this would come from the access token or API lookup
  const showcaseOwnerId = projectId === 'demo' ? 'demo-user' : `owner-${projectId}`;

  // Show code entry if no valid access token (except demo mode)
  if (!projectId) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, bgcolor: darkTheme.bg }}>
        <Paper sx={{ p: 4, maxWidth: 400, textAlign: 'center', bgcolor: darkTheme.card, color: darkTheme.text }}>
          <Typography variant="h5" color="error" sx={{ mb: 2 }}>Invalid link</Typography>
          <Typography sx={{ color: darkTheme.textSecondary }}>
            The link is invalid or missing project information.
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Show code entry for non-demo projects without token
  if (!accessToken && projectId !== 'demo') {
    return <WeddingCodeEntry projectId={projectId} onValidCode={setAccessToken} />;
  }

  // Main render with sidebar wrapper + UniversalShowcase
  return (
    <CustomThemeProvider>
    <RealTimeProvider>
    <SettingsProvider>
    <ProjectProvider>
    <FileManagementStatusProvider>
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: darkTheme.bg }}>
      {/* Left Sidebar - Custom dark theme design */}
      <Box
        sx={{
          width: 180,
          flexShrink: 0,
          bgcolor: darkTheme.sidebar,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo - Browse with green dots */}
        <Box sx={{ px: 2, py: 2.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: darkTheme.accent }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: darkTheme.accent, opacity: 0.5 }} />
          </Box>
          <Typography sx={{ color: darkTheme.text, fontWeight: 500, fontSize: 16, ml: 0.5 }}>
            Browse
          </Typography>
        </Box>

        {/* Navigation */}
        <List sx={{ px: 1, pt: 1 }} disablePadding>
          {sidebarNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              selected={activeNav === item.id}
              onClick={() => setActiveNav(item.id)}
              sx={{
                borderRadius: 1.5,
                mb: 0.25,
                py: 1,
                px: 1.5,
                minHeight: 40,
                color: darkTheme.textSecondary,
                bgcolor: activeNav === item.id ? darkTheme.navActive : 'transparent',
                '&.Mui-selected': {
                  color: darkTheme.text,
                  bgcolor: darkTheme.navActive,
                },
                '&:hover': { bgcolor: darkTheme.navActive },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                <item.icon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { fontSize: 14, fontWeight: activeNav === item.id ? 500 : 400 } } }}
              />
            </ListItemButton>
          ))}
        </List>

        {/* Subscriptions Section */}
        <Box sx={{ px: 2, mt: 3 }}>
          <Typography sx={{ color: darkTheme.textMuted, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
            Subscriptions
          </Typography>
          <List disablePadding>
            {demoSubscriptions.map((sub, idx) => (
              <ListItemButton
                key={idx}
                sx={{
                  borderRadius: 1.5,
                  py: 0.75,
                  px: 1,
                  minHeight: 36,
                  color: darkTheme.textSecondary,
                  '&:hover': { bgcolor: darkTheme.navActive },
                }}
              >
                <Avatar sx={{ width: 24, height: 24, mr: 1.5, bgcolor: darkTheme.card, fontSize: 11, color: darkTheme.textSecondary }}>
                  {sub.avatar}
                </Avatar>
                <ListItemText
                  primary={sub.name}
                  slotProps={{ primary: { sx: { fontSize: 13 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Box>

      {/* Main Content Area - UniversalShowcase */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <UniversalShowcase
          profession="videographer"
          userId={showcaseOwnerId}
          clientMode={true}
          sessionIdd={sessionId}
          clientEmail={clientEmail}
          isPublic={true}
          isOwner={false}
          compact={false}
          maxItems={100}
        />
      </Box>
    </Box>
    </FileManagementStatusProvider>
    </ProjectProvider>
    </SettingsProvider>
    </RealTimeProvider>
    </CustomThemeProvider>
  );
}
