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
} from '@mui/material';
import {
  Dashboard,
  Settings,
  Notifications,
  NotificationsOff,
  VolumeUp,
  VolumeOff,
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  return (
    <Paper
      sx={{
        width: isCollapsed ? 60 : 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        borderRadius: 4,
        background:
          'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.36)',
        color: 'rgba(255, 255, 255, 0.92)'}}
    >
      {/* Header with Collapse Toggle */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'rgba(255,255,255,0.08)'}}
      >
        {!isCollapsed && (
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.92)' }}>
            Innstillinger
          </Typography>
        )}
        <IconButton
          onClick={onToggleCollapse}
          size="small"
          sx={{
            color: 'rgba(255, 255, 255, 0.82)',
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
            '&:hover': {
              bgcolor: 'rgba(255, 140, 0, 0.08)',
              borderColor: 'rgba(255, 140, 0, 0.22)',
            },
          }}
        >
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>

      {/* User Profile Section */}
      {!isCollapsed && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Avatar
              src={userAvatar}
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'rgba(255, 140, 0, 0.18)',
                color: '#ff8c00',
                border: '1px solid rgba(255, 140, 0, 0.22)',
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.92)' }}>
                {userName}
              </Typography>
              <Chip
                label="Aktiv"
                size="small"
                sx={{
                  height: 20,
                  bgcolor: 'rgba(255, 140, 0, 0.14)',
                  color: '#ff8c00',
                  border: '1px solid rgba(255, 140, 0, 0.2)',
                }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {/* Back to Dashboard */}
        <Tooltip title={isCollapsed ? 'Tilbake til Dashboard' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/dashboard')}
            sx={{
              borderRadius: 2,
              mx: 1,
              color: 'rgba(255, 255, 255, 0.88)',
              '& .MuiListItemIcon-root': {
                color: 'rgba(255, 255, 255, 0.64)',
                minWidth: 38,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon>
              <Dashboard />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Tilbake til Dashboard" />}
          </ListItemButton>
        </Tooltip>

        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* Settings Section */}
        <Tooltip title={isCollapsed ? 'Innstillinger' : ''} placement="right">
          <ListItemButton
            onClick={() => !isCollapsed && setSettingsExpanded(!settingsExpanded)}
            sx={{
              borderRadius: 2,
              mx: 1,
              color: 'rgba(255, 255, 255, 0.88)',
              '& .MuiListItemIcon-root': {
                color: 'rgba(255, 255, 255, 0.64)',
                minWidth: 38,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon>
              <Settings />
            </ListItemIcon>
            {!isCollapsed && (
              <>
                <ListItemText primary="Innstillinger" />
                {settingsExpanded ? (
                  <ExpandLess sx={{ color: 'rgba(255, 255, 255, 0.64)' }} />
                ) : (
                  <ExpandMore sx={{ color: 'rgba(255, 255, 255, 0.64)' }} />
                )}
              </>
            )}
          </ListItemButton>
        </Tooltip>

        {/* Settings Submenu */}
        {!isCollapsed && (
          <Collapse in={settingsExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {/* Notifications Toggle */}
              <ListItem
                sx={{
                  pl: 4,
                  color: 'rgba(255, 255, 255, 0.84)',
                  '& .MuiListItemIcon-root': {
                    color: 'rgba(255, 255, 255, 0.72)',
                    minWidth: 34,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#ff8c00',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#ff8c00',
                  },
                }}
              >
                <ListItemIcon>
                  {notificationsEnabled ? <Notifications /> : <NotificationsOff />}
                </ListItemIcon>
                <ListItemText primary="Varsler" />
                <Switch
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  size="small"
                />
              </ListItem>

              {/* Sound Toggle */}
              <ListItem
                sx={{
                  pl: 4,
                  color: 'rgba(255, 255, 255, 0.84)',
                  '& .MuiListItemIcon-root': {
                    color: 'rgba(255, 255, 255, 0.72)',
                    minWidth: 34,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#ff8c00',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#ff8c00',
                  },
                }}
              >
                <ListItemIcon>
                  {soundEnabled ? <VolumeUp /> : <VolumeOff />}
                </ListItemIcon>
                <ListItemText primary="Lyd" />
                <Switch
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  size="small"
                />
              </ListItem>
            </List>
          </Collapse>
        )}

        {/* Push Notifications Section */}
        {!isCollapsed && isSupported && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'rgba(255, 255, 255, 0.92)' }}>
              Push-varsler
            </Typography>
            <PushNotificationSettings userId={userId} showDescription={false} />
          </Box>
        )}

        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* Profile */}
        <Tooltip title={isCollapsed ? 'Min Profil' : ','} placement="right">
          <ListItemButton
            onClick={() => setLocation('/profile')}
            sx={{
              borderRadius: 2,
              mx: 1,
              color: 'rgba(255, 255, 255, 0.88)',
              '& .MuiListItemIcon-root': {
                color: 'rgba(255, 255, 255, 0.64)',
                minWidth: 38,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Min Profil" />}
          </ListItemButton>
        </Tooltip>

        {/* Help */}
        <Tooltip title={isCollapsed ? 'Hjelp' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/help')}
            sx={{
              borderRadius: 2,
              mx: 1,
              color: 'rgba(255, 255, 255, 0.88)',
              '& .MuiListItemIcon-root': {
                color: 'rgba(255, 255, 255, 0.64)',
                minWidth: 38,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon>
              <Help />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Hjelp" />}
          </ListItemButton>
        </Tooltip>

        {/* About */}
        <Tooltip title={isCollapsed ? 'Om Community' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/community/about')}
            sx={{
              borderRadius: 2,
              mx: 1,
              color: 'rgba(255, 255, 255, 0.88)',
              '& .MuiListItemIcon-root': {
                color: 'rgba(255, 255, 255, 0.64)',
                minWidth: 38,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon>
              <Info />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Om Community" />}
          </ListItemButton>
        </Tooltip>
      </List>

      {/* Footer - Logout */}
      <Box sx={{ borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        <Tooltip title={isCollapsed ? 'Logg ut' : ''} placement="right">
          <ListItemButton
            onClick={() => setLocation('/logout')}
            sx={{
              borderRadius: 2,
              mx: 1,
              mb: 1,
              color: 'rgba(255, 255, 255, 0.88)',
              '& .MuiListItemIcon-root': {
                color: 'rgba(255, 255, 255, 0.64)',
                minWidth: 38,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Logg ut" />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}
