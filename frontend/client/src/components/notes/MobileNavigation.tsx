import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Divider,
  Badge,
  Avatar,
  Chip,
  Stack,
  Tooltip,
  SwipeableDrawer,
  useMediaQuery,
  useTheme,
  AppBar,
  Toolbar,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  category: 'main' | 'tools' | 'analytics' | 'gamification' | 'settings';
  path?: string;
  badge?: number;
  disabled?: boolean;
  children?: NavigationItem[]
}

interface MobileNavigationProps {
  className?: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (item: NavigationItem) => void;
  currentPath?: string;
  userProfile?: {
    name: string;
    avatar?: string;
    level: number;
    points: number;
};
}

// Mock data
const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    category: 'main',
    path: '/dashboard'
},
  {
    id: 'documents',
    label: 'Documents',
    icon: 'article',
    category: 'main',
    path: '/documents',
    badge: 3 },
  {
    id: 'interactive',
    label: 'Interactive Docs',
    icon: 'smartToy',
    category: 'main',
    path: '/interactive'
},
  {
    id: 'collaboration',
    label: 'Collaboration',
    icon: 'group',
    category: 'main',
    path: '/collaboration',
    badge: 2 },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'assessment',
    category: 'analytics',
    path: '/analytics'
},
  {
    id: 'achievements',
    label: 'Achievements',
    icon: 'star',
    category: 'gamification',
    path: '/achievements'
},
  {
    id: 'progress',
    label: 'Progress',
    icon: 'timeline',
    category: 'gamification',
    path: '/progress'
},
  {
    id: 'rewards',
    label: 'Rewards',
    icon: 'star',
    category: 'gamification',
    path: '/rewards'
},
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    category: 'settings',
    path: '/settings'
}
];

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  className ='',
  open,
  onClose,
  onNavigate,
  currentPath,
  userProfile
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Theme
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Handlers
  const handleItemClick = useCallback((item: NavigationItem) => {
    onNavigate(item);
    onClose();
}, [onNavigate, onClose]);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
}, []);

  const handleUserMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
    setShowUserMenu(true);
}, []);

  const handleUserMenuClose = useCallback(() => {
    setUserMenuAnchor(null);
    setShowUserMenu(false);
}, []);

  const getIcon = useCallback((iconName: string) => {
    switch (iconName) {
      case 'dashboard': return <CREATOR_HUB_ICONS.dashboard />;
      case 'article': return <CREATOR_HUB_ICONS.article />;
      case 'smartToy': return <CREATOR_HUB_ICONS.smartToy />;
      case 'group': return <CREATOR_HUB_ICONS.group />;
      case 'assessment': return <CREATOR_HUB_ICONS.assessment />;
      case 'star': return <CREATOR_HUB_ICONS.star />;
      case 'timeline': return <CREATOR_HUB_ICONS.timeline />;
      case 'settings': return <CREATOR_HUB_ICONS.settings />;
      case 'menu': return <CREATOR_HUB_ICONS.menu />;
      case 'close': return <CREATOR_HUB_ICONS.close />;
      case 'account': return <CREATOR_HUB_ICONS.accountCircle />;
      case 'logout': return <CREATOR_HUB_ICONS.logout />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'main': return <CREATOR_HUB_ICONS.home />;
      case 'tools': return <CREATOR_HUB_ICONS.build />;
      case 'analytics': return <CREATOR_HUB_ICONS.assessment />;
      case 'gamification': return <CREATOR_HUB_ICONS.star />;
      case 'settings': return <CREATOR_HUB_ICONS.settings />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  // Memoized data
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return navigationItems;
  }
    return navigationItems.filter(item => item.category === selectedCategory);
}, [selectedCategory]);

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(navigationItems.map(item => item.category))];
    return uniqueCategories.map(category => ({
      id: category,
      label: category.charAt(0).toUpperCase() + category.slice(),
      icon: getCategoryIcon(category)
}));
}, [getCategoryIcon]);

  const drawerContent = (
    <Box sx={{ width: 20, height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
            CreatorHub
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CREATOR_HUB_ICONS.close />
          </IconButton>
        </Stack>
      </Box>

      {/* User Profile */}
      {userProfile && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width:  40, height: 40}}>
              {userProfile.avatar ? (
                <img src={userProfile.avatar} alt={userProfile.name} style={{ width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : (
                userProfile.name.charAt(0)
              )}
            </Avatar>
            <Box sx={{ flex:  1 }}>
              <Typography variant="subtitle1" noWrap>
                {userProfile.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`Level ${userProfile.level}`} size="small" color="primary" />
                <Chip label={`${userProfile.points} pts`} size="small" color="secondary" />
              </Stack>
            </Box>
            <IconButton onClick={handleUserMenuOpen} size="small">
              <CREATOR_HUB_ICONS.accountCircle />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Category Filter */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Typography variant="subtitle2" gutterBottom>
          Categories
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            label="All"
            size="small"
            color={selectedCategory === 'all' ? 'primary' : 'default'}
            onClick={() => handleCategoryChange('all')}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              size="small"
              color={selectedCategory === category.id ? 'primary' : 'default'}
              onClick={() => handleCategoryChange(category.id)}
            />
          ))}
        </Stack>
      </Box>

      {/* Navigation Items */}
      <Box sx={{ flex: 1, overflow: 'auto'}}>
        <List>
          {filteredItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={currentPath === item.path}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText', '&:hover': {
                      backgroundColor: 'primary.dark',
                  }, '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                  },
                }}}
              >
                <ListItemIcon>
                  {item.badge ? (
                    <Badge badgeContent={item.badge} color="error">
                      {getIcon(item.icon)}
                    </Badge>
                  ) : (
                    getIcon(item.icon)
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.category}
                />
                {item.children && (
                  <CREATOR_HUB_ICONS.expandMore />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider'}}>
        <Stack direction="row" spacing={1} justifyContent="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<CREATOR_HUB_ICONS.settings />}
            onClick={() => handleItemClick({ id: 'settings', label: 'Settings', icon: 'settings', category: 'settings'})}
          >
            Settings
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CREATOR_HUB_ICONS.logout />}
            onClick={() => console.log('Logout')}
          >
            Logout
          </Button>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box className={className}>
      {/* Mobile Drawer */}
      <SwipeableDrawer
        anchor="left"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen={false}
        swipeAreaWidth={20}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
      }}
      >
        {drawerContent}
      </SwipeableDrawer>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={showUserMenu}
        onClose={handleUserMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'}}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'}}
      >
        <MenuItem onClick={handleUserMenuClose}>
          <ListItemIcon>
            <CREATOR_HUB_ICONS.accountCircle />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleUserMenuClose}>
          <ListItemIcon>
            <CREATOR_HUB_ICONS.settings />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleUserMenuClose}>
          <ListItemIcon>
            <CREATOR_HUB_ICONS.logout />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MobileNavigation;
