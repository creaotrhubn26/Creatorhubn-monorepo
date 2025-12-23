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
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
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
        borderRadius: 2}}
    >
      {/* Header with Collapse Toggle */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        {!isCollapsed && (
          <Typography variant="subtitle1" fontWeight={600}>
            Innstillinger
          </Typography>
        )}
        <IconButton onClick={onToggleCollapse} size="small">
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>

      {/* User Profile Section */}
      {!isCollapsed && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Avatar src={userAvatar} sx={{ width: 48, height: 48 }}>
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {userName}
              </Typography>
              <Chip label="Aktiv" size="small" color="success" sx={{ height: 20 }} />
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {/* Back to Dashboard */}
        <Tooltip title={isCollapsed ? 'Tilbake til Dashboard' : ','} placement="right">
          <ListItemButton onClick={() => navigate('/dashboard')}>
            <ListItemIcon>
              <Dashboard />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Tilbake til Dashboard" />}
          </ListItemButton>
        </Tooltip>

        <Divider sx={{ my: 1 }} />

        {/* Settings Section */}
        <Tooltip title={isCollapsed ? 'Innstillinger' : ','} placement="right">
          <ListItemButton onClick={() => !isCollapsed && setSettingsExpanded(!settingsExpanded)}>
            <ListItemIcon>
              <Settings />
            </ListItemIcon>
            {!isCollapsed && (
              <>
                <ListItemText primary="Innstillinger" />
                {settingsExpanded ? <ExpandLess /> : <ExpandMore />}
              </>
            )}
          </ListItemButton>
        </Tooltip>

        {/* Settings Submenu */}
        {!isCollapsed && (
          <Collapse in={settingsExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {/* Notifications Toggle */}
              <ListItem sx={{ pl: 4 }}>
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
              <ListItem sx={{ pl: 4 }}>
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

              {/* Dark Mode Toggle */}
              <ListItem sx={{ pl: 4 }}>
                <ListItemIcon>
                  {darkMode ? <Brightness4 /> : <Brightness7 />}
                </ListItemIcon>
                <ListItemText primary="Mørk modus" />
                <Switch
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  size="small"
                />
              </ListItem>
            </List>
          </Collapse>
        )}

        {/* Push Notifications Section */}
        {!isCollapsed && isSupported && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
              Push-varsler
            </Typography>
            <PushNotificationSettings userId={userId} showDescription={false} />
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Profile */}
        <Tooltip title={isCollapsed ? 'Min Profil' : ','} placement="right">
          <ListItemButton onClick={() => navigate('/profile')}>
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Min Profil" />}
          </ListItemButton>
        </Tooltip>

        {/* Help */}
        <Tooltip title={isCollapsed ? 'Hjelp' : ', '} placement="right">
          <ListItemButton onClick={() => navigate('/help')}>
            <ListItemIcon>
              <Help />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Hjelp" />}
          </ListItemButton>
        </Tooltip>

        {/* About */}
        <Tooltip title={isCollapsed ? 'Om Community' : ', '} placement="right">
          <ListItemButton onClick={() => navigate('/community/about')}>
            <ListItemIcon>
              <Info />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Om Community" />}
          </ListItemButton>
        </Tooltip>
      </List>

      {/* Footer - Logout */}
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title={isCollapsed ? 'Logg ut' : ', '} placement="right">
          <ListItemButton onClick={() => navigate('/logout')}>
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
