/**
 * CreatorHub Norge Community - Settings Sidebar
 * 
 * Collapsible sidebar with:
 * - Navigation (back to dashboard)
 * - User settings
 * - Notification preferences
 * - Community preferences
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  Collapse,
  Avatar,
  Chip,
  Button,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard,
  Settings,
  Notifications,
  NotificationsOff,
  VolumeUp,
  VolumeOff,
  Brightness4,
  Brightness7,
  ChevronLeft,
  ChevronRight,
  Person,
  Logout,
  Help,
  Info,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface CommunitySettingsSidebarProps {
  userId: string;
  userName?: string;
  userAvatar?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function CommunitySettingsSidebar({
  userId,
  userName = 'User',
  userAvatar,
  isCollapsed,
  onToggleCollapse,
}: CommunitySettingsSidebarProps) {
  const [, setLocation] = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  return (
    <Paper
      sx={{
        width: isCollapsed ? { xs: 60, sm: 64, md: 68 } : { xs: 260, sm: 280, md: 300, lg: 320 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        borderRadius: { xs: '12px', sm: '16px' },
        background: 'rgba(26, 26, 46, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Header with Collapse Toggle */}
      <Box
        sx={{
          p: { xs: 1.5, sm: 2, md: 2.5 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
        }}
      >
        {!isCollapsed && (
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: '#fff',
              fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
            }}
          >
            Innstillinger
          </Typography>
        )}
        <IconButton
          onClick={onToggleCollapse}
          size="small"
          sx={{
            color: '#f59e0b',
            '&:hover': {
              background: 'rgba(245, 158, 11, 0.1)',
            },
          }}
        >
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>

      {/* User Profile Section */}
      {!isCollapsed && (
        <Box
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
            <Avatar
              src={userAvatar}
              sx={{
                width: { xs: 44, sm: 48, md: 52 },
                height: { xs: 44, sm: 48, md: 52 },
                border: '2px solid rgba(245, 158, 11, 0.5)',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: '#fff',
                  fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  mb: 0.5,
                }}
              >
                {userName}
              </Typography>
              <Chip
                label="Aktiv"
                size="small"
                sx={{
                  height: { xs: '20px', sm: '22px', md: '24px' },
                  bgcolor: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontWeight: 600,
                }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <List
        sx={{
          flex: 1,
          overflow: 'auto',
          p: { xs: 1, sm: 1.5 },
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(245, 158, 11, 0.3)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(245, 158, 11, 0.5)',
            },
          },
        }}
      >
        {/* Back to Dashboard */}
        <Tooltip title={isCollapsed ? 'Tilbake til Dashboard' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/dashboard')}
            sx={{
              borderRadius: { xs: '10px', sm: '12px' },
              mb: { xs: 0.5, sm: 1 },
              minHeight: { xs: '44px', sm: '48px', md: '52px' },
              '&:hover': {
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              },
            }}
          >
            <ListItemIcon>
              <Dashboard sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText
                primary="Tilbake til Dashboard"
                primaryTypographyProps={{
                  sx: {
                    color: '#fff',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                    fontWeight: 500,
                  },
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        <Divider sx={{ my: { xs: 1, sm: 1.5 }, borderColor: 'rgba(245, 158, 11, 0.2)' }} />

        {/* Settings Section */}
        <Tooltip title={isCollapsed ? 'Innstillinger' : ''} placement="right">
          <ListItemButton
            onClick={() => !isCollapsed && setSettingsExpanded(!settingsExpanded)}
            sx={{
              borderRadius: { xs: '10px', sm: '12px' },
              mb: { xs: 0.5, sm: 1 },
              minHeight: { xs: '44px', sm: '48px', md: '52px' },
              '&:hover': {
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              },
            }}
          >
            <ListItemIcon>
              <Settings sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </ListItemIcon>
            {!isCollapsed && (
              <>
                <ListItemText
                  primary="Innstillinger"
                  primaryTypographyProps={{
                    sx: {
                      color: '#fff',
                      fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                      fontWeight: 500,
                    },
                  }}
                />
                {settingsExpanded ? (
                  <ExpandLess sx={{ color: '#f59e0b' }} />
                ) : (
                  <ExpandMore sx={{ color: '#f59e0b' }} />
                )}
              </>
            )}
          </ListItemButton>
        </Tooltip>

        {/* Settings Submenu */}
        {!isCollapsed && (
          <Collapse in={settingsExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: { xs: 2, sm: 2.5, md: 3 } }}>
              {/* Notifications Toggle */}
              <ListItem
                sx={{
                  pl: { xs: 2, sm: 2.5 },
                  pr: { xs: 1, sm: 1.5 },
                  py: { xs: 0.75, sm: 1 },
                  borderRadius: '10px',
                  mb: 0.5,
                  background: 'rgba(26, 26, 46, 0.4)',
                  border: '1px solid rgba(245, 158, 11, 0.1)',
                }}
              >
                <ListItemIcon>
                  {notificationsEnabled ? (
                    <Notifications sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                  ) : (
                    <NotificationsOff sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary="Varsler"
                  primaryTypographyProps={{
                    sx: {
                      color: '#fff',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    },
                  }}
                />
                <Switch
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#f59e0b',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#f59e0b',
                    },
                  }}
                />
              </ListItem>

              {/* Sound Toggle */}
              <ListItem
                sx={{
                  pl: { xs: 2, sm: 2.5 },
                  pr: { xs: 1, sm: 1.5 },
                  py: { xs: 0.75, sm: 1 },
                  borderRadius: '10px',
                  mb: 0.5,
                  background: 'rgba(26, 26, 46, 0.4)',
                  border: '1px solid rgba(245, 158, 11, 0.1)',
                }}
              >
                <ListItemIcon>
                  {soundEnabled ? (
                    <VolumeUp sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                  ) : (
                    <VolumeOff sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary="Lyd"
                  primaryTypographyProps={{
                    sx: {
                      color: '#fff',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    },
                  }}
                />
                <Switch
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#f59e0b',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#f59e0b',
                    },
                  }}
                />
              </ListItem>

              {/* Dark Mode Toggle */}
              <ListItem
                sx={{
                  pl: { xs: 2, sm: 2.5 },
                  pr: { xs: 1, sm: 1.5 },
                  py: { xs: 0.75, sm: 1 },
                  borderRadius: '10px',
                  mb: 0.5,
                  background: 'rgba(26, 26, 46, 0.4)',
                  border: '1px solid rgba(245, 158, 11, 0.1)',
                }}
              >
                <ListItemIcon>
                  {darkMode ? (
                    <Brightness4 sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                  ) : (
                    <Brightness7 sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary="Mørk modus"
                  primaryTypographyProps={{
                    sx: {
                      color: '#fff',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    },
                  }}
                />
                <Switch
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#f59e0b',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#f59e0b',
                    },
                  }}
                />
              </ListItem>

              {/* Collapse Button */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 1, sm: 1.5 }, mb: 0.5 }}>
                <Button
                  onClick={() => setSettingsExpanded(false)}
                  size="small"
                  startIcon={<ExpandLess sx={{ color: '#f59e0b' }} />}
                  sx={{
                    color: '#f59e0b',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    borderRadius: '10px',
                    px: { xs: 2, sm: 2.5 },
                    py: { xs: 0.75, sm: 1 },
                    fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                    textTransform: 'none',
                    fontWeight: 500,
                    '&:hover': {
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderColor: 'rgba(245, 158, 11, 0.5)',
                    },
                  }}
                  variant="outlined"
                >
                  Skjul innstillinger
                </Button>
              </Box>
            </List>
          </Collapse>
        )}

        {/* Push Notifications Section */}
        {!isCollapsed && isSupported && (
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderTop: '1px solid rgba(245, 158, 11, 0.2)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
              background: 'rgba(26, 26, 46, 0.4)',
              mt: 1,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                mb: 1.5,
                fontWeight: 600,
                color: '#fff',
                fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
              }}
            >
              Push-varsler
            </Typography>
            <PushNotificationSettings userId={userId} showDescription={false} />
          </Box>
        )}

        <Divider sx={{ my: { xs: 1, sm: 1.5 }, borderColor: 'rgba(245, 158, 11, 0.2)' }} />

        {/* Profile */}
        <Tooltip title={isCollapsed ? 'Min Profil' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/profile')}
            sx={{
              borderRadius: { xs: '10px', sm: '12px' },
              mb: { xs: 0.5, sm: 1 },
              minHeight: { xs: '44px', sm: '48px', md: '52px' },
              '&:hover': {
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              },
            }}
          >
            <ListItemIcon>
              <Person sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText
                primary="Min Profil"
                primaryTypographyProps={{
                  sx: {
                    color: '#fff',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                    fontWeight: 500,
                  },
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        {/* Help */}
        <Tooltip title={isCollapsed ? 'Hjelp' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/help')}
            sx={{
              borderRadius: { xs: '10px', sm: '12px' },
              mb: { xs: 0.5, sm: 1 },
              minHeight: { xs: '44px', sm: '48px', md: '52px' },
              '&:hover': {
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              },
            }}
          >
            <ListItemIcon>
              <Help sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText
                primary="Hjelp"
                primaryTypographyProps={{
                  sx: {
                    color: '#fff',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                    fontWeight: 500,
                  },
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        {/* About */}
        <Tooltip title={isCollapsed ? 'Om Community' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/community/about')}
            sx={{
              borderRadius: { xs: '10px', sm: '12px' },
              mb: { xs: 0.5, sm: 1 },
              minHeight: { xs: '44px', sm: '48px', md: '52px' },
              '&:hover': {
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              },
            }}
          >
            <ListItemIcon>
              <Info sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText
                primary="Om Community"
                primaryTypographyProps={{
                  sx: {
                    color: '#fff',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                    fontWeight: 500,
                  },
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </List>

      {/* Footer - Logout */}
      <Box
        sx={{
          borderTop: '1px solid rgba(245, 158, 11, 0.2)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)',
        }}
      >
        <Tooltip title={isCollapsed ? 'Logg ut' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/logout')}
            sx={{
              borderRadius: { xs: '10px', sm: '12px' },
              m: { xs: 1, sm: 1.5 },
              minHeight: { xs: '44px', sm: '48px', md: '52px' },
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              '&:hover': {
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
              },
            }}
          >
            <ListItemIcon>
              <Logout sx={{ color: '#ef4444', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText
                primary="Logg ut"
                primaryTypographyProps={{
                  sx: {
                    color: '#ef4444',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                    fontWeight: 600,
                  },
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}
