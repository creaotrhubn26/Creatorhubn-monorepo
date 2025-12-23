import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Container,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  Drawer,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Group as GroupIcon,
  Store as StoreIcon,
  BoxChart as BarChartIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  Email as EmailIcon,
  OpenInNew as OpenInNewIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle,
  Speed as SpeedIcon,
  CloudUpload as CloudUploadIcon,
  Monitor as MonitorIcon,
  Psychology as PsychologyIcon,
  CameraAlt as CameraIcon,
  Videocamcam as VideocamIcon,
  LibraryMusicNote as LibraryMusicIcon,
  DirectionsBusiness as BusinessIcon,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import {
  Button /* Alert & AlertDescription removed - Zero Toast Compliance */,
} from '@mui/material';
export default function AdminDashboardWithCustomization() {
  const { user, isAuthenticated } = useAuth();
  
  // Theming system
  const theming = useTheming('prototype_tester, ');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedView, setSelectedView] = useState('dashboard,');
  const theme = useTheme();
  const handleNavClick = (itemId: string) => {
    if (itemId === 'seo-marketing') {
      window.location.href = '/admin/seo-marketing';
} else {
      setSelectedView(itemId);
  }
};
  // Check if user is admin
  const isAdmin = user?.email === 'daniel@creatorhubn.com' || user?.role === 'admin';
  // Fetch real admin data from database
  const { data: metrics = {}, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/metrics', ],
    enabled: isAdmin,
});
  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: ['/api/admin/components', ],
    enabled: isAdmin,
});
  // Loading state with enhanced Material UI design
  if (metricsLoading || componentsLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'}}
      >
        <Paper sx={{ p:  4, borderRadius:  3, boxShadow:  3 ,  ...theming.getThemedCardSx() }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap:  2}}
          >
            <DashboardIcon
              sx={{
                fontSize:  48,
                color: 'primary.main',
                animation: 'pulse 2s infinite'}}
            />
            <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
              Laster Admin Dashboard...
            </Typography>
            <LinearProgress sx={{ width: 200}} />
          </Box>
        </Paper>
      </Box>
    );
}
  // Enhanced security check
  if (!isAuthenticated || !isAdmin) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'}}
      >
        <Paper sx={{ p:  4, borderRadius:  3, boxShadow:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
          <SecurityIcon sx={{ fontSize:  64, color: 'error.main', mb:  2 }} />
          <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
            Tilgang Nektet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
            Du må være logget inn som administrator (daniel@creatorhubn.com) for å få tilgang til
            admin dashboard.
          </Typography>
          <Button variant="contained" startIcon={<EmailIcon />}>
            Logg inn med Google
          </Button>
        </Paper>
      </Box>
    );
}
  // Navigation items
  // Mock data removed - using database connection
  // Extended navigation items matching the design
  // Mock data removed - using database connection
  // Dark sidebar component matching the design
  const drawer = (
    <Box
      sx={{
        width: 20,
        backgroundColor: '#2D3740',
        height: '100%',
        color: 'white'}}
    >
      {/* Logo/Brand section */}
      <Box sx={{ p:  3, borderBottom: '1px solid rgba(25,255,255,0.1)' }}>
        <Typography variant="h6"
          sx={{ 
            fontWeight: 'bold',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap:  1 }}>
          <Box
            sx={{
              width:  32,
              height:  32,
              backgroundColor: '#F56500',
              borderRadius:  1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold'}}
          >
            CH
          </Box>
          CreatorHub
        </Typography>
      </Box>
      {/* Main navigation items */}
      <Box sx={{ py:  2 }}>
        <Typography
          variant="caption"
          sx={{
            px:  3,
            color: 'rgba(25,255,255,0.6)',
            fontWeight: 60
            textTransform: 'uppercase',
            letterSpacing:  1}}
        >
          GENERELT
        </Typography>
        <List sx={{ px: 1, py: 1 }}>
          {allNavItems
            .filter((item) => item.category === 'main')
            .map((item) => (
              <ListItem
                key={item.id}
                button
                selected={selectedView === item.id}
                sx={{
                  mb: 0.5,
                  borderRadius: 2, '&.Mui-selected': {
                    backgroundColor: 'rgba(25, 1010.2)', '&:hover': {
                      backgroundColor: 'rgba(25, 1010.3)',
                  },
                }, '&:hover': {
                    backgroundColor: 'rgba(25,255,255,0.05)',
                }}}
              >
                <ListItemIcon>
                  <item.icon
                    sx={{
                      color: selectedView === item.id ? '#F56500' : 'rgba(25,255,255,0.7)',
                      fontSize:  20}}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: electedView === item.id ? 600 : 40,
                      color: selectedView === item.id ? 'white' : 'rgba(25,255,255,0.8)',
                      fontSize: '14px',
                  }}}
                />
              </ListItem>
            ))}
        </List>
        {/* Users section */}
        <Typography
          variant="caption"
          sx={{
            px:  3,
            color: 'rgba(25,255,255,0.6)',
            fontWeight: 60
            textTransform: 'uppercase',
            letterSpacing:  1,
            mt:  2,
            display: 'block'}}
        >
          BRUKERE
        </Typography>
        <List sx={{ px: 1, py: 1 }}>
          {allNavItems
            .filter((item) => item.category === 'users')
            .map((item) => (
              <ListItem
                key={item.id}
                button
                selected={selectedView === item.id}
                sx={{
                  mb: 0.5,
                  borderRadius: 2, '&.Mui-selected': {
                    backgroundColor: 'rgba(25, 1010.2)','&:hover': {
                      backgroundColor: 'rgba(25, 1010.3)',
                  },
                }, '&:hover': {
                    backgroundColor: 'rgba(25,255,255,0.05)',
                }}}
              >
                <ListItemIcon>
                  <item.icon
                    sx={{
                      color: selectedView === item.id ? '#F56500' : 'rgba(25,255,255,0.7)',
                      fontSize:  20}}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: electedView === item.id ? 600 : 40,
                      color: selectedView === item.id ? 'white' : 'rgba(25,255,255,0.8)',
                      fontSize: '14px',
                  }}}
                />
              </ListItem>
            ))}
        </List>
        {/* Others section */}
        <Typography
          variant="caption"
          sx={{
            px:  3,
            color: 'rgba(25,255,255,0.6)',
            fontWeight: 60
            textTransform: 'uppercase',
            letterSpacing:  1,
            mt:  2,
            display: 'block'}}
        >
          ANDRE
        </Typography>
        <List sx={{ px: 1, py: 1 }}>
          {allNavItems
            .filter((item) => item.category === 'others')
            .map((item) => (
              <ListItem
                key={item.id}
                button
                selected={selectedView === item.id}
                sx={{
                  mb: 0.5,
                  borderRadius: 2, '&.Mui-selected': {
                    backgroundColor: 'rgba(25, 1010.2)','&:hover': {
                      backgroundColor: 'rgba(25, 1010.3)',
                  },
                }, '&:hover': {
                    backgroundColor: 'rgba(25,255,255,0.05)',
                }}}
              >
                <ListItemIcon>
                  <item.icon
                    sx={{
                      color: selectedView === item.id ? '#F56500' : 'rgba(25,255,255,0.7)',
                      fontSize:  20}}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: electedView === item.id ? 600 : 40,
                      color: selectedView === item.id ? 'white' : 'rgba(25,255,255,0.8)',
                      fontSize: '14px',
                  }}}
                />
              </ListItem>
            ))}
        </List>
      </Box>
    </Box>
  );
  // Modern dashboard layout matching the design
  const renderDashboard = () => (
    <Box sx={{ p:  3 }}>
      {/* Welcome message */}
      <Paper
        sx={{
          p:  2,
          mb:  3,
          backgroundColor: '#FFF3E0',
          border: '1px solid #FFB740',
          borderRadius:  2}}
       sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <WarningIcon sx={{ color: '#F57C00'}} />
          <Typography variant="body2" color="#E65100">
            Vi ønsker å informere deg om at våre servere opplever for øyeblikket tekniske
            vanskeligheter.
          </Typography>
        </Box>
      </Paper>
      {/* Top stats cards - matching CoreUI design */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '150px',
              background: 'linear-gradient(135deg, #6366F1 0%, #5B21B6 100%)',
              color: 'white',
              position: 'relative'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ position: 'relative', zIndex: 2}}>
              <Typography variant="h3" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                26K
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0, .mb:  1 }}>
                (-12.4% ↓)
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 50}}>
                Users
              </Typography>
            </Box>
            {/* Decorative chart line */}
            <Box
              sx={{
                position: 'absolute',
                bottom:  0,
                right:  0,
                width: '100%',
                height: '40px',
                background: 'rgba(25,255,255,0.1)',
                borderRadius: '20px 20px 0 0'}}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '150px',
              background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
              color: 'white',
              position: 'relative'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ position: 'relative', zIndex: 2}}>
              <Typography variant="h3" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                $6.200
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0, .mb:  1 }}>
                (40.9% ↑)
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 50}}>
                Income
              </Typography>
            </Box>
            {/* Decorative chart line */}
            <Box
              sx={{
                position: 'absolute',
                bottom:  0,
                right:  0,
                width: '100%',
                height: '40px',
                background: 'rgba(25,255,255,0.1)',
                borderRadius: '20px 20px 0 0'}}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '150px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: 'white',
              position: 'relative'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ position: 'relative', zIndex: 2}}>
              <Typography variant="h3" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                2.49
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0, .mb:  1 }}>
                (84.7% ↑)
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 50}}>
                Conversion Rate
              </Typography>
            </Box>
            {/* Decorative chart line */}
            <Box
              sx={{
                position: 'absolute',
                bottom:  0,
                right:  0,
                width: '100%',
                height: '40px',
                background: 'rgba(25,255,255,0.1)',
                borderRadius: '20px 20px 0 0'}}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '150px',
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              color: 'white',
              position: 'relative'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ position: 'relative', zIndex: 2}}>
              <Typography variant="h3" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                44K
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0, .mb:  1 }}>
                (-23.6% ↓)
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 50}}>
                Sessions
              </Typography>
            </Box>
            {/* Decorative chart line */}
            <Box
              sx={{
                position: 'absolute',
                bottom:  0,
                right:  0,
                width: '100%',
                height: '40px',
                background: 'rgba(25,255,255,0.1)',
                borderRadius: '20px 20px 0 0'}}
            />
          </Paper>
        </Grid>
      </Grid>
      {/* Social media stats cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '140px',
              background: '#3B5990',
              color: 'white'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ textAlign: 'center'}}>
              <Box sx={{ fontSize: '40px', mb:  1 }}>📘</Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mb:  1 }}>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    89K
                  </Typography>
                  <Typography variant="caption">FRIENDS</Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    459
                  </Typography>
                  <Typography variant="caption">FEEDS</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '140px',
              background: '#1DA1F0',
              color: 'white'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ textAlign: 'center'}}>
              <Box sx={{ fontSize: '40px', mb:  1 }}>🐦</Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mb:  1 }}>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    973k
                  </Typography>
                  <Typography variant="caption">FOLLOWERS</Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    1.792
                  </Typography>
                  <Typography variant="caption">TWEETS</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '140px',
              background: '#0077B0',
              color: 'white'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ textAlign: 'center'}}>
              <Box sx={{ fontSize: '40px', mb:  1 }}>💼</Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mb:  1 }}>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    500
                  </Typography>
                  <Typography variant="caption">CONTACTS</Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    1.292
                  </Typography>
                  <Typography variant="caption">FEEDS</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p:  3,
              borderRadius:  3,
              height: '140px',
              background: '#F59E00',
              color: 'white'}}
           sx={theming.getThemedCardSx()}>
            <Box sx={{ textAlign: 'center'}}>
              <Box sx={{ fontSize: '40px', mb:  1 }}>📅</Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mb:  1 }}>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    12+
                  </Typography>
                  <Typography variant="caption">EVENTS</Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 'bold' }}>
                    4
                  </Typography>
                  <Typography variant="caption">MEETINGS</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      {/* Traffic & Sales section */}
      <Paper sx={{ p:  3, borderRadius:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{  fontWeight: 600}}>
          Traffic & Sales
        </Typography>
        <Grid container spacing={3} sx={{ mt:  1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p:  2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                New Clients
              </Typography>
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                9,123
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p:  2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                Recurring Clients
              </Typography>
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                22,643
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p:  2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                Pageviews
              </Typography>
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                78,623
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center', p:  2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                Organic
              </Typography>
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                49,123
              </Typography>
            </Box>
          </Grid>
        </Grid>
        {/* Progress bars */}
        <Box sx={{ mt:  3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <Typography variant="body2" sx={{ mr: 2, minWidth: '60px'}}>
              Monday
            </Typography>
            <LinearProgress
              variant="determinate"
              value={34}
              sx={{
                flexGrow:  1,
                height:  8,
                borderRadius:  4,
                mr: 2'& .MuiLinearProgress-bar': { backgroundColor: '#06B6D4',}}}
            />
            <Typography variant="body2">34%</Typography>
          </Box>
        </Box>
      </Paper>
      {/* User demographics */}
      <Paper sx={{ p:  3, borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb:  2}}
        >
          <Typography variant="body2" color="text.secondary">
            👤 Male
          </Typography>
          <Typography variant="h6" sx={{  fontWeight: 'bold' }}>
            53%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={53}
          sx={{
            height:  8,
            borderRadius: 4'& .MuiLinearProgress-bar': { backgroundColor: '#F59E0B',}}}
        />
      </Paper>
    </Box>
  );
  // Main dashboard content
  const renderContent = () => {
    switch (selectedView) {
      case 'dashboard':
        return renderDashboard();
      case 'products':
        return <Typography variant="h4" sx={{ color: theming.colors.primary }}>Produkter - Under utvikling</Typography>;
      case 'users':
        return <Typography variant="h4" sx={{ color: theming.colors.primary }}>Brukerhåndtering - Under utvikling</Typography>;
      case 'system':
        return <Typography variant="h4" sx={{ color: theming.colors.primary }}>Systeminnstillinger - Under utvikling</Typography>;
      case 'analytics':
        return <Typography variant="h4" sx={{ color: theming.colors.primary }}>Analyser - Under utvikling</Typography>;
      case 'settings':
        return <Typography variant="h4" sx={{ color: theming.colors.primary }}>Innstillinger - Under utvikling</Typography>;
      default: return renderDashboard();
}
};
  // Main layout return
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'grey.50'}}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: , theme.zIndex.drawer +, 1,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: 'none',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`}}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" sx={{ mr: 2, display: { sm: 'none',} }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{  flexGrow: 1, fontWeight: 'bold' }}>
            CreatorHub Norge - Admin Dashboard
          </Typography>
          <Tooltip title="Varslinger">
            <IconButton color="inherit" sx={{ mr:  1 }}>
              <NotificationsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Konto">
            <IconButton color="inherit">
              {theming.getThemedIcon('accountCircle')}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      {/* Navigation Drawer */}
      <Box component="nav" sx={{ width: { sm: 280,}, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none',}, '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 20,
              backgroundColor: '#2D3740',
          }}}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block',}, '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 20,
              backgroundColor: '#2D3740',
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          }}}
        >
          {drawer}
        </Drawer>
      </Box>
      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow:  1,
          width: { sm: `calc(100% - 280px), `,},
          backgroundColor: 'grey.5',
          minHeight: '100vh'}}
      >
        <Toolbar />
        <Container maxWidth="xl" sx={{ py:  4 }}>
          {renderContent()}
        </Container>
      </Box>
    </Box>
  );
}
